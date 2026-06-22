import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView, Dimensions } from 'react-native';
import { requestOTP, verifyOTP, devLogin } from './src/api/client';
import { getApiBase, setApiBase, clearApiBase, setAccessToken } from './src/config/apiBase';
import RequestsScreen from './src/screens/RequestsScreen';
import RequestDetailScreen from './src/screens/RequestDetailScreen';
import TherapistProfileScreen from './src/screens/TherapistProfileScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import ChatScreen from './src/screens/ChatScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import PostsScreen from './src/screens/PostsScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';

const { width } = Dimensions.get('window');

export default function App() {
	const [step, setStep] = useState<'phone' | 'otp' | 'done' | 'detail' | 'profile' | 'conversations' | 'chat' | 'video-call' | 'posts' | 'create-post'>('phone');
	const [phone, setPhone] = useState('');
	const [otp, setOtp] = useState('');
	const [loading, setLoading] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [apiBase, setApiBaseState] = useState('');
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
	const [chatParams, setChatParams] = useState<{ sessionId?: number; requestId?: number } | null>(null);
	const [videoCallParams, setVideoCallParams] = useState<{ url: string; sessionId: number } | null>(null);
	const phoneAutoSentRef = useRef(false);
	const otpAutoVerifiedRef = useRef(false);

	useEffect(() => {
		(async () => {
			const b = await getApiBase();
			setApiBaseState(b);
		})();
	}, []);

	const handlePhoneChange = (text: string) => {
		let numbers = text.replace(/[^0-9]/g, '');
		
		// Remove leading zero if present
		if (numbers.length > 0 && numbers[0] === '0') {
			numbers = numbers.substring(1);
		}
		
		// Limit to 10 digits
		numbers = numbers.slice(0, 10);
		
		setPhone(numbers);
	};

	// Auto-send OTP when phone number reaches 10 digits
	useEffect(() => {
		if (step === 'phone' && phone.length === 10 && !loading && !phoneAutoSentRef.current) {
			phoneAutoSentRef.current = true;
			const fullPhone = `+98${phone}`;
			(async () => {
				try {
					setLoading(true);
					setMessage(null);
					await requestOTP(fullPhone);
					setStep('otp');
					otpAutoVerifiedRef.current = false;
					setMessage({ type: 'success', text: 'کد تایید با موفقیت ارسال شد' });
					setTimeout(() => setMessage(null), 5000);
				} catch (e: any) {
					phoneAutoSentRef.current = false;
					setMessage({ type: 'error', text: e?.response?.data?.detail || 'ارسال کد با خطا مواجه شد' });
				} finally {
					setLoading(false);
				}
			})();
		}
		if (phone.length < 10) {
			phoneAutoSentRef.current = false;
			setMessage(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [phone, step]);

	const handleOtpChange = (text: string) => {
		const numbers = text.replace(/[^0-9]/g, '').slice(0, 6);
		setOtp(numbers);
	};

	// Auto-verify OTP when code reaches 6 digits
	useEffect(() => {
		if (step === 'otp' && otp.length === 6 && !loading && !otpAutoVerifiedRef.current) {
			otpAutoVerifiedRef.current = true;
			const fullPhone = `+98${phone}`;
			(async () => {
				try {
					setLoading(true);
					setMessage(null);
					const res = await verifyOTP(fullPhone, otp);
					await setAccessToken(res.access);
					setStep('done');
					setMessage({ type: 'success', text: `خوش آمدید ${res.user.phone}` });
				} catch (e: any) {
					otpAutoVerifiedRef.current = false;
					setMessage({ type: 'error', text: e?.response?.data?.detail || 'کد نامعتبر است' });
				} finally {
					setLoading(false);
				}
			})();
		}
		if (otp.length < 6) {
			otpAutoVerifiedRef.current = false;
			setMessage(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [otp, step]);

	const onRequest = async () => {
		const fullPhone = `+98${phone}`;
		if (!phone || phone.length < 10) return;
		try {
			setLoading(true);
			setMessage(null);
			phoneAutoSentRef.current = true;
			await requestOTP(fullPhone);
			setStep('otp');
			otpAutoVerifiedRef.current = false;
			setMessage({ type: 'success', text: 'کد تایید با موفقیت ارسال شد' });
			setTimeout(() => setMessage(null), 5000);
		} catch (e: any) {
			phoneAutoSentRef.current = false;
			setMessage({ type: 'error', text: e?.response?.data?.detail || 'ارسال کد با خطا مواجه شد' });
		} finally {
			setLoading(false);
		}
	};

	const onVerify = async () => {
		if (!otp || otp.length !== 6) return;
		const fullPhone = `+98${phone}`;
		try {
			setLoading(true);
			setMessage(null);
			otpAutoVerifiedRef.current = true;
			const res = await verifyOTP(fullPhone, otp);
			await setAccessToken(res.access);
			setStep('done');
			setMessage({ type: 'success', text: `خوش آمدید ${res.user.phone}` });
		} catch (e: any) {
			otpAutoVerifiedRef.current = false;
			setMessage({ type: 'error', text: e?.response?.data?.detail || 'کد نامعتبر است' });
		} finally {
			setLoading(false);
		}
	};

	// ⚠️ TODO: REMOVE BEFORE PRODUCTION - Development only quick login
	const onQuickLogin = async () => {
		const defaultPhone = '+989934421746'; // Default therapist phone
		try {
			setLoading(true);
			setMessage(null);
			const res = await devLogin(defaultPhone);
			await setAccessToken(res.access);
			setStep('done');
			setMessage({ type: 'success', text: `خوش آمدید ${res.user.phone}` });
		} catch (e: any) {
			setMessage({ type: 'error', text: e?.response?.data?.detail || 'ورود سریع با خطا مواجه شد' });
		} finally {
			setLoading(false);
		}
	};

	const navigation = {
		goBack: () => {
			if (step === 'detail' || step === 'profile' || step === 'conversations') {
				setStep('done');
				setSelectedRequestId(null);
			} else if (step === 'chat') {
				setStep('conversations');
				setChatParams(null);
			} else if (step === 'video-call') {
				setStep('chat');
				setVideoCallParams(null);
			} else if (step === 'posts' || step === 'create-post') {
				setStep('done');
			}
		},
		navigate: (screen: string, params?: any) => {
			if (screen === 'RequestDetail') {
				setSelectedRequestId(params?.requestId || null);
				setStep('detail');
			} else if (screen === 'Profile') {
				setStep('profile');
			} else if (screen === 'Conversations') {
				setStep('conversations');
			} else if (screen === 'Chat') {
				setChatParams(params || {});
				setStep('chat');
			} else if (screen === 'VideoCall') {
				setVideoCallParams(params || {});
				setStep('video-call');
			} else if (screen === 'Posts') {
				setStep('posts');
			} else if (screen === 'CreatePost') {
				setStep('create-post');
			}
		},
	};

	if (step === 'done') {
		return <RequestsScreen navigation={navigation} />;
	}

	if (step === 'detail' && selectedRequestId) {
		return (
			<RequestDetailScreen
				route={{ params: { requestId: selectedRequestId } }}
				navigation={navigation}
			/>
		);
	}

	if (step === 'profile') {
		return <TherapistProfileScreen navigation={navigation} />;
	}

	if (step === 'conversations') {
		return <ConversationsScreen navigation={navigation} />;
	}

	if (step === 'chat' && chatParams) {
		return (
			<ChatScreen
				route={{ params: chatParams }}
				navigation={navigation}
			/>
		);
	}

	if (step === 'video-call' && videoCallParams) {
		return (
			<VideoCallScreen
				route={{ params: videoCallParams }}
				navigation={navigation}
			/>
		);
	}

	if (step === 'posts') {
		return <PostsScreen navigation={navigation} />;
	}

	if (step === 'create-post') {
		return <CreatePostScreen navigation={navigation} />;
	}

	return (
		<View style={styles.container}>
			<View style={styles.background}>
				<View style={styles.gradientCircle1} />
				<View style={styles.gradientCircle2} />
			</View>
			
			<SafeAreaView style={styles.safeArea}>
				<TouchableOpacity 
					onPress={() => setSettingsOpen(true)} 
					style={styles.settingsButton}
					activeOpacity={0.7}
				>
					<Text style={styles.settingsIcon}>⚙️</Text>
				</TouchableOpacity>

				<ScrollView 
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					{step === 'phone' && (
						<View style={styles.card}>
							<View style={styles.iconContainer}>
								<Text style={styles.icon}>💙</Text>
							</View>
							<Text style={styles.title}>خوش آمدید درمانگر</Text>
							<Text style={styles.subtitle}>شماره موبایل خود را وارد کنید</Text>
							
							{message && (
								<View style={[styles.messageBox, message.type === 'success' ? styles.messageSuccess : styles.messageError]}>
									<Text style={styles.messageText}>{message.text}</Text>
								</View>
							)}

							<View style={styles.inputContainer}>
								<Text style={styles.inputLabel}>شماره موبایل</Text>
								<View style={styles.phoneInputContainer}>
									<View style={styles.phonePrefix}>
										<Text style={styles.phonePrefixText}>+98</Text>
									</View>
									<TextInput
										style={[styles.input, styles.phoneInput]}
										placeholder="9123456789"
										placeholderTextColor="#9ca3af"
										keyboardType="phone-pad"
										value={phone}
										onChangeText={handlePhoneChange}
										autoFocus={false}
									/>
								</View>
							</View>

							<TouchableOpacity 
								style={[styles.button, loading && styles.buttonDisabled]} 
								onPress={onRequest} 
								disabled={loading || phone.length < 10}
								activeOpacity={0.8}
							>
								{loading ? (
									<ActivityIndicator color="#fff" size="small" />
								) : (
									<Text style={styles.buttonText}>ارسال کد تایید</Text>
								)}
							</TouchableOpacity>

							<Text style={styles.helpText}>
								کد تایید از طریق پیامک برای شما ارسال خواهد شد
							</Text>

							{/* ⚠️ TODO: REMOVE BEFORE PRODUCTION - Development only quick login button */}
							<TouchableOpacity 
								style={[styles.button, styles.quickLoginButton, loading && styles.buttonDisabled]} 
								onPress={onQuickLogin} 
								disabled={loading}
								activeOpacity={0.8}
							>
								{loading ? (
									<ActivityIndicator color="#fff" size="small" />
								) : (
									<Text style={styles.buttonText}>⚡ ورود سریع (توسعه)</Text>
								)}
							</TouchableOpacity>
						</View>
					)}

					{step === 'otp' && (
						<View style={styles.card}>
							<View style={styles.iconContainer}>
								<Text style={styles.icon}>🔐</Text>
							</View>
							<Text style={styles.title}>کد تایید را وارد کنید</Text>
							<Text style={styles.subtitle}>
								کد ۶ رقمی ارسال شده به شماره{'\n'}
								<Text style={styles.phoneHighlight}>+98{phone}</Text>
							</Text>
							
							{message && (
								<View style={[styles.messageBox, message.type === 'success' ? styles.messageSuccess : styles.messageError]}>
									<Text style={styles.messageText}>{message.text}</Text>
								</View>
							)}
							
							<View style={styles.inputContainer}>
								<Text style={styles.inputLabel}>کد تایید</Text>
								<TextInput
									style={[styles.input, styles.otpInput]}
									placeholder="000000"
									placeholderTextColor="#9ca3af"
									keyboardType="number-pad"
									value={otp}
									onChangeText={handleOtpChange}
									maxLength={6}
									autoFocus={true}
									textAlign="center"
								/>
							</View>

							<TouchableOpacity 
								style={[styles.button, loading && styles.buttonDisabled]} 
								onPress={onVerify} 
								disabled={loading || otp.length !== 6}
								activeOpacity={0.8}
							>
								{loading ? (
									<ActivityIndicator color="#fff" size="small" />
								) : (
									<Text style={styles.buttonText}>تایید و ورود</Text>
								)}
							</TouchableOpacity>

							<TouchableOpacity 
								onPress={() => { 
									setStep('phone'); 
									setPhone(''); 
									setOtp(''); 
									setMessage(null);
									otpAutoVerifiedRef.current = false;
									phoneAutoSentRef.current = false;
								}}
								style={styles.editPhoneButton}
								activeOpacity={0.7}
							>
								<Text style={styles.editPhoneIcon}>✏️</Text>
								<Text style={styles.editPhoneText}>ویرایش شماره موبایل</Text>
							</TouchableOpacity>
						</View>
					)}
				</ScrollView>
			</SafeAreaView>

			<Modal visible={settingsOpen} animationType="slide" transparent>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>تنظیمات API</Text>
							<TouchableOpacity 
								onPress={() => setSettingsOpen(false)}
								style={styles.closeButton}
							>
								<Text style={styles.closeButtonText}>✕</Text>
							</TouchableOpacity>
						</View>
						<Text style={styles.modalSubtitle}>آدرس سرور API</Text>
						<TextInput
							style={styles.modalInput}
							placeholder="https://your-api-url.com"
							placeholderTextColor="#9ca3af"
							value={apiBase}
							onChangeText={setApiBaseState}
							autoCapitalize="none"
							autoCorrect={false}
						/>
						<View style={styles.modalButtons}>
							<TouchableOpacity
								style={[styles.modalButton, styles.modalButtonSecondary]} 
								onPress={async () => { 
									await clearApiBase(); 
									const b = await getApiBase(); 
									setApiBaseState(b); 
									setSettingsOpen(false); 
								}}
								activeOpacity={0.7}
							>
								<Text style={styles.modalButtonTextSecondary}>بازنشانی</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.modalButton, styles.modalButtonPrimary]} 
								onPress={async () => { 
									await setApiBase(apiBase); 
									setSettingsOpen(false); 
								}}
								activeOpacity={0.7}
							>
								<Text style={styles.modalButtonTextPrimary}>ذخیره</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1e3a8a', // Blue background
	},
	background: {
		position: 'absolute',
		width: '100%',
		height: '100%',
	},
	gradientCircle1: {
		position: 'absolute',
		width: width * 1.2,
		height: width * 1.2,
		borderRadius: width * 0.6,
		backgroundColor: '#3b82f6',
		opacity: 0.15,
		top: -width * 0.3,
		right: -width * 0.3,
	},
	gradientCircle2: {
		position: 'absolute',
		width: width * 0.8,
		height: width * 0.8,
		borderRadius: width * 0.4,
		backgroundColor: '#60a5fa',
		opacity: 0.1,
		bottom: -width * 0.2,
		left: -width * 0.2,
	},
	safeArea: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		justifyContent: 'center',
		padding: 20,
	},
	settingsButton: {
		position: 'absolute',
		top: 50,
		right: 20,
		zIndex: 10,
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
		backdropFilter: 'blur(10px)',
	},
	settingsIcon: {
		fontSize: 20,
	},
	card: {
		width: '100%',
		maxWidth: 400,
		alignSelf: 'center',
		backgroundColor: '#ffffff',
		borderRadius: 24,
		padding: 32,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.15,
		shadowRadius: 20,
		elevation: 10,
	},
	iconContainer: {
		alignItems: 'center',
		marginBottom: 24,
	},
	icon: {
		fontSize: 64,
	},
	title: {
		fontSize: 32,
		fontWeight: '800',
		color: '#1e3a8a',
		textAlign: 'center',
		marginBottom: 8,
		letterSpacing: -0.5,
		writingDirection: 'rtl',
	},
	subtitle: {
		fontSize: 16,
		color: '#64748b',
		textAlign: 'center',
		marginBottom: 32,
		lineHeight: 22,
		writingDirection: 'rtl',
	},
	phoneHighlight: {
		color: '#1e40af',
		fontWeight: '600',
	},
	inputContainer: {
		marginBottom: 24,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#1e40af',
		marginBottom: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	input: {
		backgroundColor: '#f1f5f9',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		borderRadius: 12,
		padding: 16,
		fontSize: 16,
		color: '#1e3a8a',
		fontWeight: '500',
	},
	otpInput: {
		fontSize: 24,
		letterSpacing: 8,
		fontWeight: '700',
	},
	button: {
		backgroundColor: '#2563eb',
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 56,
		shadowColor: '#1e3a8a',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 5,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '700',
		letterSpacing: 0.5,
	},
	helpText: {
		fontSize: 13,
		color: '#94a3b8',
		textAlign: 'center',
		marginTop: 20,
	},
	phoneInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	phonePrefix: {
		backgroundColor: '#e0e7ff',
		borderWidth: 2,
		borderColor: '#c7d2fe',
		borderRightWidth: 0,
		borderTopLeftRadius: 12,
		borderBottomLeftRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 16,
		justifyContent: 'center',
	},
	phonePrefixText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1e40af',
	},
	phoneInput: {
		flex: 1,
		borderTopLeftRadius: 0,
		borderBottomLeftRadius: 0,
		borderLeftWidth: 0,
	},
	editPhoneButton: {
		marginTop: 20,
		paddingVertical: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	editPhoneIcon: {
		fontSize: 16,
		marginLeft: 8,
	},
	editPhoneText: {
		color: '#2563eb',
		fontSize: 14,
		fontWeight: '600',
		textDecorationLine: 'underline',
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	modalCard: {
		width: '100%',
		maxWidth: 400,
		backgroundColor: '#fff',
		borderRadius: 20,
		padding: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.2,
		shadowRadius: 20,
		elevation: 10,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	modalTitle: {
		fontSize: 24,
		fontWeight: '700',
		color: '#1e3a8a',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	closeButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: '#e2e8f0',
		justifyContent: 'center',
		alignItems: 'center',
	},
	closeButtonText: {
		fontSize: 18,
		color: '#64748b',
		fontWeight: '600',
	},
	modalSubtitle: {
		fontSize: 14,
		color: '#64748b',
		marginBottom: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	modalInput: {
		backgroundColor: '#f1f5f9',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		borderRadius: 12,
		padding: 14,
		fontSize: 14,
		color: '#1e3a8a',
		marginBottom: 20,
	},
	modalButtons: {
		flexDirection: 'row',
	},
	modalButton: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: 'center',
		marginHorizontal: 6,
	},
	modalButtonPrimary: {
		backgroundColor: '#2563eb',
	},
	modalButtonSecondary: {
		backgroundColor: '#e2e8f0',
	},
	modalButtonTextPrimary: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	modalButtonTextSecondary: {
		color: '#1e40af',
		fontSize: 16,
		fontWeight: '600',
	},
	messageBox: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
		borderWidth: 1,
	},
	messageSuccess: {
		backgroundColor: '#dbeafe',
		borderColor: '#93c5fd',
	},
	messageError: {
		backgroundColor: '#fee2e2',
		borderColor: '#fca5a5',
	},
	messageText: {
		fontSize: 14,
		fontWeight: '500',
		textAlign: 'center',
		writingDirection: 'rtl',
		color: '#1e3a8a',
	},
	quickLoginButton: {
		backgroundColor: '#48bb78',
		marginTop: 12,
	},
});

