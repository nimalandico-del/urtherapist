import React, { useState, useEffect, useRef } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	ScrollView,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Dimensions,
	Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { getChatMessages, sendChatMessage, markMessagesAsRead, getTherapySession, getTherapySessionByRequest, endTherapySession, ChatMessage, TherapySession, createSkyroomRoom, getSkyroomRoom, createSkyroomLoginUrl } from '../api/client';
import { ChatWebSocket } from '../api/websocket';
import { getApiBase } from '../config/apiBase';
import { getBucketFileUrl } from '../utils/storage';

const { width } = Dimensions.get('window');

interface ChatScreenProps {
	route: {
		params: {
			sessionId?: number;
			requestId?: number;
		};
	};
	navigation: any;
}

export default function ChatScreen({ route, navigation }: ChatScreenProps) {
	const { sessionId: routeSessionId, requestId } = route.params;
	const [sessionId, setSessionId] = useState<number | null>(routeSessionId || null);
	const [session, setSession] = useState<TherapySession | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [messageText, setMessageText] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [endingSession, setEndingSession] = useState(false);
	const [recording, setRecording] = useState<Audio.Recording | null>(null);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
	const [sound, setSound] = useState<Audio.Sound | null>(null);
	const scrollViewRef = useRef<ScrollView>(null);
	const wsRef = useRef<ChatWebSocket | null>(null);
	const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		loadSession();
		// Request audio permissions
		Audio.requestPermissionsAsync().then((result: { status: string }) => {
			if (result.status !== 'granted') {
				console.log('Audio permission not granted');
			}
		});
		return () => {
			if (wsRef.current) {
				wsRef.current.disconnect();
			}
			if (sound) {
				sound.unloadAsync();
			}
			if (recording) {
				recording.stopAndUnloadAsync();
			}
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (sessionId && session) {
			loadMessages();
			// Disconnect previous WebSocket before connecting new one
			if (wsRef.current) {
				wsRef.current.disconnect();
			}
			connectWebSocket();
		}
		// Cleanup on unmount or sessionId change
		return () => {
			if (wsRef.current) {
				wsRef.current.disconnect();
				wsRef.current = null;
			}
		};
	}, [sessionId, session]);

	const loadSession = async () => {
		try {
			setLoading(true);
			let sessionData: TherapySession;
			
			if (requestId) {
				sessionData = await getTherapySessionByRequest(requestId);
			} else if (routeSessionId) {
				sessionData = await getTherapySession(routeSessionId);
			} else {
				Alert.alert('خطا', 'شناسه جلسه یا درخواست یافت نشد');
				navigation.goBack();
				return;
			}
			
			setSession(sessionData);
			setSessionId(sessionData.id);
		} catch (e: any) {
			Alert.alert('خطا', e?.response?.data?.detail || 'خطا در بارگذاری جلسه');
			console.error('Error loading session:', e);
			navigation.goBack();
		} finally {
			setLoading(false);
		}
	};

	// Helper function to determine if message is from current user
	const isMessageMine = (message: ChatMessage): boolean => {
		if (!session) return false;
		// In therapist app, current user is the therapist
		return message.sender_id === session.therapist;
	};

	const loadMessages = async () => {
		if (!sessionId) return;
		try {
			const messagesData = await getChatMessages(sessionId);
			// Recalculate is_mine based on current user (therapist)
			const messagesWithCorrectOwnership = messagesData.map(msg => ({
				...msg,
				is_mine: isMessageMine(msg)
			}));
			setMessages(messagesWithCorrectOwnership);
			// Mark messages as read
			await markMessagesAsRead(sessionId);
			scrollToBottom();
		} catch (e: any) {
			console.error('Error loading messages:', e);
		}
	};

	const connectWebSocket = () => {
		if (!sessionId) return;
		
		// Don't create new connection if one already exists for this session
		if (wsRef.current && wsRef.current.isConnected()) {
			return;
		}
		
		const ws = new ChatWebSocket();
		wsRef.current = ws;
		
		ws.connect(sessionId, async (message) => {
			if (message.type === 'chat_message') {
				const newMessage = message.data as ChatMessage;
				// Recalculate is_mine based on current user (therapist)
				const messageWithCorrectOwnership = {
					...newMessage,
					is_mine: isMessageMine(newMessage)
				};
				setMessages((prev) => {
					// Avoid duplicates by checking both id and content+timestamp
					const existing = prev.find((m) => 
						m.id === messageWithCorrectOwnership.id || 
						(m.content === messageWithCorrectOwnership.content && 
						 Math.abs(new Date(m.created_at).getTime() - new Date(messageWithCorrectOwnership.created_at).getTime()) < 1000)
					);
					if (existing) {
						return prev;
					}
					return [...prev, messageWithCorrectOwnership];
				});
				scrollToBottom();
				// Mark as read
				markMessagesAsRead(sessionId);
			} else if (message.type === 'session_ended') {
				setSession(message.data as TherapySession);
				Alert.alert('اتمام جلسه', 'جلسه درمانی پایان یافت');
				if (recording) {
					await cancelRecording();
				}
			}
		});
	};

	const startRecording = async () => {
		try {
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: true,
				playsInSilentModeIOS: true,
			});
			
			const { recording: newRecording } = await Audio.Recording.createAsync(
				Audio.RecordingOptionsPresets.HIGH_QUALITY
			);
			setRecording(newRecording);
			setRecordingDuration(0);
			
			recordingTimerRef.current = setInterval(() => {
				setRecordingDuration((prev) => prev + 1);
			}, 1000);
		} catch (err) {
			console.error('Failed to start recording', err);
			Alert.alert('خطا', 'امکان شروع ضبط صدا وجود ندارد');
		}
	};

	const stopRecording = async () => {
		if (!recording) return;
		
		if (recordingTimerRef.current) {
			clearInterval(recordingTimerRef.current);
			recordingTimerRef.current = null;
		}
		
		try {
			await recording.stopAndUnloadAsync();
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: false,
			});
			
			const uri = recording.getURI();
			setRecording(null);
			
			if (uri && sessionId) {
				await sendVoiceMessage(uri);
			}
			
			setRecordingDuration(0);
		} catch (err) {
			console.error('Failed to stop recording', err);
			Alert.alert('خطا', 'امکان توقف ضبط صدا وجود ندارد');
		}
	};

	const cancelRecording = async () => {
		if (!recording) return;
		
		if (recordingTimerRef.current) {
			clearInterval(recordingTimerRef.current);
			recordingTimerRef.current = null;
		}
		
		try {
			await recording.stopAndUnloadAsync();
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: false,
			});
			setRecording(null);
			setRecordingDuration(0);
		} catch (err) {
			console.error('Failed to cancel recording', err);
		}
	};

	const sendVoiceMessage = async (uri: string | null) => {
		if (!uri || !sessionId || sending) return;
		
		setSending(true);
		
		try {
			const apiBase = await getApiBase();
			const baseClean = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
			const fullUri = uri.startsWith('file://') ? uri : `file://${uri}`;
			
			const newMessage = await sendChatMessage(
				sessionId,
				'پیام صوتی',
				'VOICE',
				{
					uri: fullUri,
					type: 'audio/m4a',
					name: `voice_${Date.now()}.m4a`,
				}
			);
			
			// Recalculate is_mine based on current user (therapist)
			const messageWithCorrectOwnership = {
				...newMessage,
				is_mine: isMessageMine(newMessage)
			};
			setMessages((prev) => {
				// Avoid duplicates - check if message already exists
				const exists = prev.find((m) => 
					m.id === messageWithCorrectOwnership.id || 
					(m.content === messageWithCorrectOwnership.content && 
					 Math.abs(new Date(m.created_at).getTime() - new Date(messageWithCorrectOwnership.created_at).getTime()) < 1000)
				);
				if (exists) {
					return prev;
				}
				return [...prev, messageWithCorrectOwnership];
			});
			scrollToBottom();
		} catch (e: any) {
			Alert.alert('خطا', e?.response?.data?.detail || 'خطا در ارسال پیام صوتی');
		} finally {
			setSending(false);
		}
	};

	const playVoiceMessage = async (message: ChatMessage) => {
		if (!message.voice_file_url) return;
		
		try {
			// Stop current sound if playing
			if (sound) {
				await sound.unloadAsync();
				setSound(null);
			}
			
			if (playingMessageId === message.id) {
				// If already playing this message, stop it
				setPlayingMessageId(null);
				return;
			}
			
			const voiceUrl = getBucketFileUrl(message.voice_file_url);
			if (!voiceUrl) return;
			
			const { sound: newSound } = await Audio.Sound.createAsync(
				{ uri: voiceUrl },
				{ shouldPlay: true }
			);
			
			setSound(newSound);
			setPlayingMessageId(message.id);
			
			newSound.setOnPlaybackStatusUpdate((status: any) => {
				if (status.isLoaded && status.didJustFinish) {
					setPlayingMessageId(null);
					newSound.unloadAsync();
					setSound(null);
				}
			});
		} catch (err) {
			console.error('Failed to play voice message', err);
			Alert.alert('خطا', 'امکان پخش پیام صوتی وجود ندارد');
		}
	};

	const handleSend = async () => {
		if (!messageText.trim() || !sessionId || sending) return;
		
		const content = messageText.trim();
		setMessageText('');
		setSending(true);
		
		try {
			const newMessage = await sendChatMessage(sessionId, content);
			// Recalculate is_mine based on current user (therapist)
			const messageWithCorrectOwnership = {
				...newMessage,
				is_mine: isMessageMine(newMessage)
			};
			setMessages((prev) => {
				// Avoid duplicates - check if message already exists
				const exists = prev.find((m) => 
					m.id === messageWithCorrectOwnership.id || 
					(m.content === messageWithCorrectOwnership.content && 
					 Math.abs(new Date(m.created_at).getTime() - new Date(messageWithCorrectOwnership.created_at).getTime()) < 1000)
				);
				if (exists) {
					return prev;
				}
				return [...prev, messageWithCorrectOwnership];
			});
			scrollToBottom();
		} catch (e: any) {
			Alert.alert('خطا', e?.response?.data?.detail || 'خطا در ارسال پیام');
			setMessageText(content); // Restore message
		} finally {
			setSending(false);
		}
	};

	const scrollToBottom = () => {
		setTimeout(() => {
			scrollViewRef.current?.scrollToEnd({ animated: true });
		}, 100);
	};

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleTimeString('fa-IR', {
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#2563eb" />
					<Text style={styles.loadingText}>در حال بارگذاری...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!session) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>جلسه درمانی یافت نشد</Text>
					<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
						<Text style={styles.backButtonText}>بازگشت</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	const otherUserName = session.patient_name || 'بیمار';
	const otherUserPhone = session.patient_phone || '';
	const currentUserPhone = session.therapist_phone || '';

	const handleEndSession = async () => {
		if (!sessionId) return;

		Alert.alert(
			'پایان جلسه',
			'آیا می‌خواهید این جلسه را پایان دهید؟',
			[
				{
					text: 'خیر',
					style: 'cancel',
				},
				{
					text: 'بله',
					onPress: async () => {
						setEndingSession(true);
						try {
							const updatedSession = await endTherapySession(sessionId);
							setSession(updatedSession);
							Alert.alert('اتمام جلسه', 'جلسه با موفقیت پایان یافت');
						} catch (e: any) {
							Alert.alert('خطا', e?.response?.data?.detail || 'خطا در پایان جلسه');
						} finally {
							setEndingSession(false);
						}
					}
				},
			]
		);
	};

	const handleVideoCall = async () => {
		if (!sessionId) return;
		
		try {
			// Get user display name
			let userName = 'درمانگر';
			if (session.therapist_name) {
				userName = session.therapist_name;
			}
			
			// Try to get existing room by name, or create new one
			let roomId: number;
			const roomName = `therapy-session-${sessionId}`;
			
			try {
				const existingRoom = await getSkyroomRoom(roomName);
				roomId = existingRoom.id;
			} catch (error) {
				// Room doesn't exist, create it
				const roomTitle = `جلسه درمانی - ${session.patient_name || 'بیمار'}`;
				roomId = await createSkyroomRoom(sessionId, roomTitle);
			}
			
			// Create login URL with operator access
			const loginUrl = await createSkyroomLoginUrl({
				room_id: roomId,
				user_id: `therapist-${session.therapist}`,
				nickname: userName,
				access: 3, // Operator access
				language: 'fa',
				ttl: 3600, // 1 hour
			});
			
			// Navigate to video call screen
			navigation.navigate('VideoCall', {
				url: loginUrl,
				sessionId: sessionId,
			});
		} catch (e: any) {
			Alert.alert('خطا', e?.message || e?.response?.data?.detail || 'خطا در شروع تماس ویدیویی');
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
					<Text style={styles.backIcon}>←</Text>
				</TouchableOpacity>
				<View style={styles.headerInfo}>
					<Text style={styles.headerTitle}>جلسه درمانی</Text>
					<Text style={styles.headerSubtitle}>{otherUserName}</Text>
					{otherUserPhone ? (
						<Text style={styles.headerPhone}>📞 {otherUserPhone}</Text>
					) : null}
					{currentUserPhone ? (
						<Text style={styles.headerMyPhone}>شماره شما: {currentUserPhone}</Text>
					) : null}
				</View>
				<TouchableOpacity onPress={handleVideoCall} style={styles.videoCallButton}>
					<Text style={styles.videoCallButtonText}>📹</Text>
				</TouchableOpacity>
			</View>

			{session?.is_active ? (
				<View style={styles.endSessionContainer}>
					<TouchableOpacity
						style={[styles.endSessionButton, endingSession && styles.endSessionButtonDisabled]}
						onPress={handleEndSession}
						disabled={endingSession}
					>
						<Text style={styles.endSessionButtonText}>{endingSession ? 'در حال پایان جلسه...' : 'اتمام جلسه'}</Text>
					</TouchableOpacity>
				</View>
			) : null}

			<KeyboardAvoidingView
				style={styles.keyboardView}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
			>
				<ScrollView
					ref={scrollViewRef}
					style={styles.messagesContainer}
					contentContainerStyle={styles.messagesContent}
					onContentSizeChange={scrollToBottom}
				>
					{messages.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>هنوز پیامی ارسال نشده است</Text>
							<Text style={styles.emptySubtext}>شما می‌توانید شروع به گفتگو کنید</Text>
						</View>
					) : (
						messages.map((message, index) => {
							const isMyMessage = message.is_mine === true;
							return (
							<View
								key={`message-${message.id}-${index}`}
								style={[
									styles.messageContainer,
									isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
								]}
							>
								<View
									style={[
										styles.messageBubble,
										isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
									]}
								>
									{message.message_type === 'VOICE' && message.voice_file_url ? (
										<TouchableOpacity
											onPress={() => playVoiceMessage(message)}
											style={styles.voiceMessageContainer}
											activeOpacity={0.7}
										>
											<Text style={styles.voiceIcon}>
												{playingMessageId === message.id ? '⏸️' : '▶️'}
											</Text>
											<Text
												style={[
													styles.voiceMessageText,
													isMyMessage ? styles.myMessageText : styles.otherMessageText,
												]}
											>
												{playingMessageId === message.id ? 'در حال پخش...' : 'پیام صوتی'}
											</Text>
										</TouchableOpacity>
									) : (
										<Text
											style={[
												styles.messageText,
												isMyMessage ? styles.myMessageText : styles.otherMessageText,
											]}
										>
											{message.content}
										</Text>
									)}
									<Text
										style={[
											styles.messageTime,
											isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
										]}
									>
										{formatTime(message.created_at)}
									</Text>
								</View>
							</View>
							);
						})
					)}
				</ScrollView>

				{!session.is_active ? (
					<View style={styles.sessionEndedContainer}>
						<Text style={styles.sessionEndedText}>جلسه پایان یافته است. ارسال پیام غیرفعال شد.</Text>
					</View>
				) : recording ? (
					<View style={styles.recordingContainer}>
						<View style={styles.recordingInfo}>
							<View style={styles.recordingIndicator} />
							<Text style={styles.recordingText}>
								{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
							</Text>
						</View>
						<View style={styles.recordingButtons}>
							<TouchableOpacity
								style={styles.cancelRecordingButton}
								onPress={cancelRecording}
							>
								<Text style={styles.cancelRecordingText}>✕</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.stopRecordingButton}
								onPress={stopRecording}
							>
								<Text style={styles.stopRecordingText}>✓</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : (
					<View style={styles.inputContainer}>
						<TouchableOpacity
							style={styles.voiceButton}
							onPress={startRecording}
							disabled={sending}
						>
							<Text style={styles.voiceButtonText}>🎤</Text>
						</TouchableOpacity>
						<TextInput
							style={styles.input}
							placeholder="پیام خود را بنویسید..."
							placeholderTextColor="#9ca3af"
							value={messageText}
							onChangeText={setMessageText}
							multiline
							textAlign="right"
							textAlignVertical="center"
						/>
						<TouchableOpacity
							style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
							onPress={handleSend}
							disabled={!messageText.trim() || sending}
						>
							{sending ? (
								<ActivityIndicator color="#fff" size="small" />
							) : (
								<Text style={styles.sendButtonText}>📤</Text>
							)}
						</TouchableOpacity>
					</View>
				)}
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f3f4f6',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#6b7280',
		writingDirection: 'rtl',
	},
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	errorText: {
		fontSize: 16,
		color: '#ef4444',
		textAlign: 'center',
		marginBottom: 20,
		writingDirection: 'rtl',
	},
	backButton: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		backgroundColor: '#2563eb',
		borderRadius: 8,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 16,
		backgroundColor: '#fff',
		borderBottomWidth: 1,
		borderBottomColor: '#e5e7eb',
	},
	backIconButton: {
		width: 40,
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	backIcon: {
		fontSize: 24,
		color: '#1f2937',
		fontWeight: 'bold',
	},
	headerInfo: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#1f2937',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#6b7280',
		marginTop: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	headerPhone: {
		fontSize: 13,
		color: '#2563eb',
		marginTop: 2,
		writingDirection: 'rtl',
		textAlign: 'right',
		fontWeight: '500',
	},
	headerMyPhone: {
		fontSize: 12,
		color: '#9ca3af',
		marginTop: 2,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	videoCallButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: '#2563eb',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 8,
	},
	videoCallButtonText: {
		fontSize: 20,
	},
	endSessionContainer: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		backgroundColor: '#fff7f5',
		borderBottomWidth: 1,
		borderBottomColor: '#fee2e2',
	},
	endSessionButton: {
		backgroundColor: '#dc2626',
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: 'center',
	},
	endSessionButtonDisabled: {
		opacity: 0.65,
	},
	endSessionButtonText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '700',
	},
	sessionEndedContainer: {
		padding: 14,
		backgroundColor: '#f8fafc',
		borderTopWidth: 1,
		borderTopColor: '#e5e7eb',
		alignItems: 'center',
	},
	sessionEndedText: {
		color: '#6b7280',
		fontSize: 14,
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	keyboardView: {
		flex: 1,
	},
	messagesContainer: {
		flex: 1,
	},
	messagesContent: {
		padding: 16,
		paddingBottom: 8,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyText: {
		fontSize: 16,
		color: '#6b7280',
		textAlign: 'center',
		writingDirection: 'rtl',
		marginBottom: 8,
	},
	emptySubtext: {
		fontSize: 14,
		color: '#9ca3af',
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	messageContainer: {
		marginBottom: 12,
		flexDirection: 'row',
		width: '100%',
	},
	myMessageContainer: {
		justifyContent: 'flex-end',
		alignItems: 'flex-end',
	},
	otherMessageContainer: {
		justifyContent: 'flex-start',
		alignItems: 'flex-start',
	},
	messageBubble: {
		maxWidth: width * 0.75,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 16,
	},
	myMessageBubble: {
		backgroundColor: '#2563eb',
		borderBottomRightRadius: 4,
		alignSelf: 'flex-end',
	},
	otherMessageBubble: {
		backgroundColor: '#fff',
		borderBottomLeftRadius: 4,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		alignSelf: 'flex-start',
	},
	messageText: {
		fontSize: 15,
		lineHeight: 20,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	myMessageText: {
		color: '#fff',
	},
	otherMessageText: {
		color: '#1f2937',
	},
	messageTime: {
		fontSize: 11,
		marginTop: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	myMessageTime: {
		color: '#bfdbfe',
	},
	otherMessageTime: {
		color: '#9ca3af',
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		padding: 12,
		backgroundColor: '#fff',
		borderTopWidth: 1,
		borderTopColor: '#e5e7eb',
	},
	voiceButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: '#ef4444',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 8,
	},
	voiceButtonText: {
		fontSize: 20,
	},
	recordingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 12,
		backgroundColor: '#fee2e2',
		borderTopWidth: 1,
		borderTopColor: '#fca5a5',
	},
	recordingInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	recordingIndicator: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: '#ef4444',
		marginLeft: 8,
	},
	recordingText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#991b1b',
		writingDirection: 'rtl',
	},
	recordingButtons: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	cancelRecordingButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#dc2626',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 8,
	},
	cancelRecordingText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	},
	stopRecordingButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#16a34a',
		justifyContent: 'center',
		alignItems: 'center',
	},
	stopRecordingText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	},
	voiceMessageContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
	},
	voiceIcon: {
		fontSize: 24,
		marginLeft: 8,
	},
	voiceMessageText: {
		fontSize: 15,
		fontWeight: '600',
		writingDirection: 'rtl',
	},
	input: {
		flex: 1,
		minHeight: 44,
		maxHeight: 100,
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: '#f3f4f6',
		borderRadius: 22,
		fontSize: 15,
		color: '#1f2937',
		marginLeft: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	sendButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: '#2563eb',
		justifyContent: 'center',
		alignItems: 'center',
	},
	sendButtonDisabled: {
		opacity: 0.5,
	},
	sendButtonText: {
		fontSize: 20,
	},
});

