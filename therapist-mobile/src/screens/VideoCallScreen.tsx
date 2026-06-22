import React, { useRef, useEffect, useState } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	Alert,
	ActivityIndicator,
	View,
	Text,
	Platform,
	TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';

interface VideoCallScreenProps {
	route: {
		params: {
			url: string;
			sessionId: number;
		};
	};
	navigation: any;
}

export default function VideoCallScreen({ route, navigation }: VideoCallScreenProps) {
	const { url, sessionId } = route.params;
	const webViewRef = useRef<WebView>(null);
	const [permissionsGranted, setPermissionsGranted] = useState(false);
	const [webViewReady, setWebViewReady] = useState(false);

	// Request permissions immediately when screen loads - this shows native Android dialogs
	useEffect(() => {
		const requestPermissions = async () => {
			try {
				console.log('Requesting permissions...');
				
				// Request audio permissions (shows native dialog)
				const audioResult = await Audio.requestPermissionsAsync();
				console.log('Audio permission result:', audioResult.status);
				
				if (audioResult.status === 'granted') {
					console.log('All permissions granted');
					setPermissionsGranted(true);
				} else {
					console.log('Some permissions not granted');
					Alert.alert(
						'دسترسی مورد نیاز',
						'برای استفاده از تماس ویدیویی، نیاز به دسترسی به میکروفون داریم. لطفاً در تنظیمات برنامه دسترسی‌ها را فعال کنید.',
						[
							{ text: 'بازگشت', onPress: () => navigation.goBack() },
							{ text: 'تلاش مجدد', onPress: requestPermissions },
						]
					);
				}
			} catch (error) {
				console.error('Permission request error:', error);
			}
		};
		
		requestPermissions();
	}, []);

	const handleError = (syntheticEvent: any) => {
		const { nativeEvent } = syntheticEvent;
		console.error('WebView error:', nativeEvent);
		Alert.alert('خطا', 'خطا در بارگذاری تماس ویدیویی', [
			{ text: 'بازگشت', onPress: () => navigation.goBack() },
		]);
	};

	const handlePermissionRequest = async (request: any) => {
		const { resources } = request;
		console.log('🔔🔔🔔 WebView permission request received from Skyroom:', resources);
		console.log('- Full request object:', JSON.stringify(request, null, 2));
		
		// Check if we need microphone
		const needsMicrophone = resources.includes('microphone') || resources.includes('audio');
		
		console.log('- Needs microphone:', needsMicrophone);
		
		// Deny camera/video requests
		const needsCamera = resources.includes('camera') || resources.includes('video');
		if (needsCamera) {
			console.log('❌ Camera permission request denied');
			request.deny();
			return;
		}
		
		if (needsMicrophone) {
			// Verify permissions are still granted
			if (Platform.OS === 'android') {
				// Check microphone permission
				try {
					const audioPermission = await Audio.getPermissionsAsync();
					console.log('🎤 Microphone permission check:', audioPermission.status);
					if (audioPermission.status !== 'granted') {
						console.log('⚠️ Microphone permission not granted, requesting...');
						const result = await Audio.requestPermissionsAsync();
						console.log('🎤 Microphone permission request result:', result.status);
						if (result.status !== 'granted') {
							console.log('❌ Microphone permission denied');
							request.deny();
							return;
						}
						console.log('✅ Microphone permission granted');
					} else {
						console.log('✅ Microphone permission already granted');
					}
				} catch (err) {
					console.error('❌ Microphone permission error:', err);
					request.deny();
					return;
				}
			}
			
			// Grant WebView permission request - THIS IS CRITICAL
			console.log('✅✅✅ GRANTING WebView permissions for Skyroom:', resources);
			try {
				request.grant(resources);
				console.log('✅ Permission grant successful');
			} catch (grantError) {
				console.error('❌ Error granting permissions:', grantError);
				request.deny();
			}
		} else {
			console.log('⚠️ Unknown permission request, denying:', resources);
			request.deny();
		}
	};

	const handleConsoleMessage = (event: any) => {
		const message = event.nativeEvent.message;
		console.log('🌐 WebView Console:', message);
	};

	const handleLoadEnd = () => {
		setWebViewReady(true);
	};

	// Inject JavaScript to help with microphone access on different devices
		const injectedJavaScript = `
		(function() {
			console.log('🔧 JavaScript injected for Skyroom microphone access');
			
			// Log WebView capabilities
			console.log('📊 WebView Info:');
			console.log('- User Agent:', navigator.userAgent);
			console.log('- mediaDevices exists:', !!navigator.mediaDevices);
			console.log('- getUserMedia exists:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
			console.log('- Permissions API:', !!navigator.permissions);
			
			// Wait for page to be fully loaded
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', init);
			} else {
				init();
			}
			
			function init() {
				console.log('🚀 Initializing microphone support for Skyroom');
				
				// Override getUserMedia to log all calls and ensure proper constraints
				if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
					const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
					navigator.mediaDevices.getUserMedia = function(constraints) {
						console.log('🎤 getUserMedia called by Skyroom with:', JSON.stringify(constraints));
						
						// Ensure we request audio if needed
						const finalConstraints = {
							video: constraints.video !== false && constraints.video !== undefined ? constraints.video : false,
							audio: constraints.audio !== false && constraints.audio !== undefined ? constraints.audio : true
						};
						
						console.log('🎤 Final constraints:', JSON.stringify(finalConstraints));
						
						return originalGetUserMedia(finalConstraints)
							.then(function(stream) {
								console.log('✅ getUserMedia SUCCESS - stream received');
								console.log('- Video tracks:', stream.getVideoTracks().length);
								console.log('- Audio tracks:', stream.getAudioTracks().length);
								if (stream.getAudioTracks().length > 0) {
									const track = stream.getAudioTracks()[0];
									console.log('- Audio device:', track.label);
								}
								return stream;
							})
							.catch(function(error) {
								console.error('❌ getUserMedia ERROR:', error.name, error.message);
								console.error('- Error details:', JSON.stringify({
									name: error.name,
									message: error.message,
									constraint: error.constraint
								}));
								
								if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
									console.error('⚠️ Permission denied - onPermissionRequest should have granted this');
								} else if (error.name === 'NotFoundError') {
									console.error('⚠️ No microphone found');
								} else if (error.name === 'NotReadableError') {
									console.error('⚠️ Microphone is being used by another app');
								}
								
								throw error;
							});
					};
				} else {
					console.error('❌ navigator.mediaDevices.getUserMedia is not available!');
				}
				
				// Log available audio devices periodically
				if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
					setTimeout(function() {
						navigator.mediaDevices.enumerateDevices().then(function(devices) {
							const audioDevices = devices.filter(d => d.kind === 'audioinput');
							console.log('📱 Available audio devices:', audioDevices.length);
							audioDevices.forEach(function(device) {
								console.log('- Device:', device.kind, device.label || '(no label - permission needed)');
							});
						}).catch(function(err) {
							console.log('Error enumerating devices:', err);
						});
					}, 2000);
				}
			}
		})();
		true; // Required for injected JavaScript
	`;


	if (!permissionsGranted) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#2563eb" />
					<Text style={styles.loadingText}>در حال درخواست دسترسی‌ها...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<WebView
				ref={webViewRef}
				source={{ uri: url }}
				style={styles.webview}
				javaScriptEnabled={true}
				domStorageEnabled={true}
				mediaPlaybackRequiresUserAction={false}
				allowsInlineMediaPlayback={true}
				allowsProtectedMedia={true}
				mediaCapturePermissionGrantType="grant"
				onPermissionRequest={handlePermissionRequest}
				onConsoleMessage={handleConsoleMessage}
				onMessage={(event) => {
					const message = event.nativeEvent.data;
					console.log('📨 Message from WebView:', message);
					try {
						const data = JSON.parse(message);
						if (data.type === 'permission-request') {
							console.log('📨 Permission request via message:', data.resources);
							// Handle permission request via message
						}
					} catch (e) {
						// Not JSON, ignore
					}
				}}
				injectedJavaScript={injectedJavaScript}
				injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
				onLoadEnd={handleLoadEnd}
				onError={handleError}
				onHttpError={handleError}
				androidHardwareAccelerationDisabled={false}
				androidLayerType="hardware"
				originWhitelist={['*']}
				mixedContentMode="always"
				thirdPartyCookiesEnabled={true}
				sharedCookiesEnabled={true}
				startInLoadingState={true}
				allowsFullscreenVideo={true}
				allowsBackForwardNavigationGestures={false}
				renderLoading={() => (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color="#2563eb" />
						<Text style={styles.loadingText}>در حال بارگذاری...</Text>
					</View>
				)}
				userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
			/>
			<View style={styles.buttonOverlay}>
				<TouchableOpacity 
					onPress={() => navigation.goBack()} 
					style={styles.backButton}
					activeOpacity={0.7}
				>
					<Text style={styles.backButtonText}>← بازگشت به چت</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	webview: {
		flex: 1,
		backgroundColor: '#000',
	},
	buttonOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: 'flex-end',
		alignItems: 'center',
		paddingBottom: 40,
		pointerEvents: 'box-none',
	},
	backButton: {
		backgroundColor: '#2563eb',
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 5,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
		writingDirection: 'rtl',
		textAlign: 'center',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#000',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#fff',
		writingDirection: 'rtl',
		textAlign: 'center',
	},
});
