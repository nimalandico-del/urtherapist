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
import { getSupportMessages, sendSupportMessage, markSupportMessagesAsRead, SupportChatMessage } from '../api/client';
import { SupportChatWebSocket } from '../api/websocket';
import { getApiBase } from '../config/apiBase';
import { getBucketFileUrl } from '../utils/storage';

const { width } = Dimensions.get('window');

interface SupportChatScreenProps {
	navigation: any;
}

export default function SupportChatScreen({ navigation }: SupportChatScreenProps) {
	const [messages, setMessages] = useState<SupportChatMessage[]>([]);
	const [messageText, setMessageText] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [recording, setRecording] = useState<Audio.Recording | null>(null);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
	const [sound, setSound] = useState<Audio.Sound | null>(null);
	const scrollViewRef = useRef<ScrollView>(null);
	const wsRef = useRef<SupportChatWebSocket | null>(null);
	const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		loadMessages();
		// Request audio permissions
		Audio.requestPermissionsAsync().then((result: { status: string }) => {
			if (result.status !== 'granted') {
				console.log('Audio permission not granted');
			}
		});
		connectWebSocket();
		
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

	const loadMessages = async () => {
		try {
			setLoading(true);
			const messagesData = await getSupportMessages();
			setMessages(messagesData);
			// Mark messages as read
			await markSupportMessagesAsRead();
			scrollToBottom();
		} catch (e: any) {
			console.error('Error loading support messages:', e);
			Alert.alert('خطا', e?.response?.data?.detail || 'خطا در بارگذاری پیام‌ها');
		} finally {
			setLoading(false);
		}
	};

	const connectWebSocket = () => {
		// Don't create new connection if one already exists
		if (wsRef.current && wsRef.current.isConnected()) {
			return;
		}
		
		const ws = new SupportChatWebSocket();
		wsRef.current = ws;
		
		ws.connect((message) => {
			if (message.type === 'support_message') {
				const newMessage = message.data as SupportChatMessage;
				setMessages((prev) => {
					// Avoid duplicates by checking both id and content+timestamp
					const existing = prev.find((m) => 
						m.id === newMessage.id || 
						(m.content === newMessage.content && 
						 Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 1000)
					);
					if (existing) {
						return prev;
					}
					return [...prev, newMessage];
				});
				scrollToBottom();
				// Mark as read
				markSupportMessagesAsRead();
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
			
			// Start timer
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
			
			if (uri) {
				// Send voice message
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
		if (!uri || sending) return;
		
		setSending(true);
		
		try {
			const apiBase = await getApiBase();
			const baseClean = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
			const fullUri = uri.startsWith('file://') ? uri : `file://${uri}`;
			
			const newMessage = await sendSupportMessage(
				'پیام صوتی',
				'VOICE',
				{
					uri: fullUri,
					type: 'audio/m4a',
					name: `voice_${Date.now()}.m4a`,
				}
			);
			
			setMessages((prev) => {
				// Avoid duplicates - check if message already exists
				const exists = prev.find((m) => 
					m.id === newMessage.id || 
					(m.content === newMessage.content && 
					 Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 1000)
				);
				if (exists) {
					return prev;
				}
				return [...prev, newMessage];
			});
			scrollToBottom();
		} catch (e: any) {
			Alert.alert('خطا', e?.response?.data?.detail || 'خطا در ارسال پیام صوتی');
		} finally {
			setSending(false);
		}
	};

	const playVoiceMessage = async (message: SupportChatMessage) => {
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
		if (!messageText.trim() || sending) return;
		
		const content = messageText.trim();
		setMessageText('');
		setSending(true);
		
		try {
			const newMessage = await sendSupportMessage(content);
			setMessages((prev) => {
				// Avoid duplicates - check if message already exists
				const exists = prev.find((m) => 
					m.id === newMessage.id || 
					(m.content === newMessage.content && 
					 Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 1000)
				);
				if (exists) {
					return prev;
				}
				return [...prev, newMessage];
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

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
					<Text style={styles.backIcon}>←</Text>
				</TouchableOpacity>
				<View style={styles.headerInfo}>
					<Text style={styles.headerTitle}>پشتیبانی</Text>
					<Text style={styles.headerSubtitle}>تیم پشتیبانی آماده پاسخگویی است</Text>
				</View>
			</View>

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
							<Text style={styles.emptySubtext}>شما می‌توانید سوالات خود را از تیم پشتیبانی بپرسید</Text>
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

				{recording ? (
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

