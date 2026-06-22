import React, { useRef, useEffect, useState } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	Alert,
	ActivityIndicator,
	View,
	Text,
	TouchableOpacity,
	Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import { useCameraPermissions } from 'expo-camera';

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
	const [cameraPermission, requestCameraPermission] = useCameraPermissions();

	// Request permissions immediately when screen loads - this shows native Android dialogs
	useEffect(() => {
		const requestPermissions = async () => {
			try {
				console.log('Requesting permissions...');
				
				// Request audio permissions (shows native dialog)
				const audioResult = await Audio.requestPermissionsAsync();
				console.log('Audio permission result:', audioResult.status);
				
				// Request camera permissions (shows native dialog)
				let cameraResult;
				if (!cameraPermission || !cameraPermission.granted) {
					console.log('Requesting camera permission...');
					cameraResult = await requestCameraPermission();
					console.log('Camera permission result:', cameraResult.granted);
				} else {
					console.log('Camera permission already granted');
					cameraResult = { granted: true };
				}
				
				if (audioResult.status === 'granted' && cameraResult.granted) {
					console.log('All permissions granted');
					setPermissionsGranted(true);
				} else {
					console.log('Some permissions not granted');
					const missingPermissions = [];
					if (audioResult.status !== 'granted') missingPermissions.push('میکروفون');
					if (!cameraResult.granted) missingPermissions.push('دوربین');
					
					Alert.alert(
						'دسترسی مورد نیاز',
						`برای استفاده از تماس ویدیویی، نیاز به دسترسی به ${missingPermissions.join(' و ')} داریم. لطفاً در تنظیمات برنامه دسترسی‌ها را فعال کنید.`,
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
	}, [cameraPermission, requestCameraPermission]);

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
		
		// Check if we need camera/video
		const needsCamera = resources.includes('camera') || resources.includes('video');
		console.log('- Needs camera:', needsCamera);
		
		// If no camera or microphone needed, deny
		if (!needsCamera && !needsMicrophone) {
			console.log('⚠️ Unknown permission request, denying:', resources);
			request.deny();
			return;
		}
		
		// Quick check: if permissions are already granted, grant immediately
		let cameraOk = true;
		let microphoneOk = true;
		
		// Check camera permission status
		if (needsCamera) {
			if (Platform.OS === 'android') {
				if (!cameraPermission || !cameraPermission.granted) {
					console.log('⚠️ Camera permission not granted, requesting...');
					try {
						const result = await requestCameraPermission();
						cameraOk = result.granted;
						console.log('📷 Camera permission request result:', result.granted);
					} catch (err) {
						console.error('❌ Camera permission error:', err);
						cameraOk = false;
					}
				} else {
					console.log('✅ Camera permission already granted');
				}
			}
		}
		
		// Check microphone permission status
		if (needsMicrophone) {
			if (Platform.OS === 'android') {
				try {
					const audioPermission = await Audio.getPermissionsAsync();
					if (audioPermission.status !== 'granted') {
						console.log('⚠️ Microphone permission not granted, requesting...');
						const result = await Audio.requestPermissionsAsync();
						microphoneOk = result.status === 'granted';
						console.log('🎤 Microphone permission request result:', result.status);
					} else {
						console.log('✅ Microphone permission already granted');
					}
				} catch (err) {
					console.error('❌ Microphone permission error:', err);
					microphoneOk = false;
				}
			}
		}
		
		// Grant or deny based on permissions
		if (cameraOk && microphoneOk) {
			// Grant ALL requested resources - CRITICAL: grant exactly what was requested
			console.log('✅✅✅ GRANTING WebView permissions for Skyroom:', resources);
			try {
				// Grant the exact resources that were requested
				request.grant(resources);
				console.log('✅ Permission grant successful for:', resources);
			} catch (grantError) {
				console.error('❌ Error granting permissions:', grantError);
				// Try to grant individual resources if granting all fails
				try {
					if (needsCamera) {
						request.grant(['camera', 'video'].filter(r => resources.includes(r)));
					}
					if (needsMicrophone) {
						request.grant(['microphone', 'audio'].filter(r => resources.includes(r)));
					}
					console.log('✅ Granted permissions individually');
				} catch (err) {
					console.error('❌ Failed to grant permissions individually:', err);
					request.deny();
				}
			}
		} else {
			console.log('❌ Not all permissions granted - Camera:', cameraOk, 'Microphone:', microphoneOk);
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

	// Inject JavaScript to help with camera and microphone access
	const injectedJavaScript = `
		(function() {
			console.log('🔧 JavaScript injected for Skyroom camera and microphone access');
			
			// Log WebView capabilities
			console.log('📊 WebView Info:');
			console.log('- User Agent:', navigator.userAgent);
			console.log('- mediaDevices exists:', !!navigator.mediaDevices);
			console.log('- getUserMedia exists:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
			console.log('- Permissions API:', !!navigator.permissions);
			
			// Help with Permissions API if available
			if (navigator.permissions) {
				// Override permissions.query to help Skyroom detect camera access
				const originalQuery = navigator.permissions.query.bind(navigator.permissions);
				navigator.permissions.query = function(descriptor) {
					console.log('🔍 Permissions API query:', descriptor.name);
					if (descriptor.name === 'camera' || descriptor.name === 'microphone') {
						return originalQuery(descriptor).then(function(result) {
							console.log('📋 Permission query result for', descriptor.name, ':', result.state);
							// If permission is prompt, try to resolve it
							if (result.state === 'prompt') {
								// Return granted since we've already granted at device level
								return Promise.resolve({
									state: 'granted',
									onchange: null
								});
							}
							return result;
						}).catch(function(err) {
							console.log('⚠️ Permission query error:', err);
							// Return granted as fallback
							return Promise.resolve({
								state: 'granted',
								onchange: null
							});
						});
					}
					return originalQuery(descriptor);
				};
			}
			
			// Wait for page to be fully loaded
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', init);
			} else {
				init();
			}
			
			function init() {
				console.log('🚀 Initializing camera and microphone support for Skyroom');
				
				// Monitor getUserMedia calls but don't interfere - let native permissions handle it
				if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
					const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
					navigator.mediaDevices.getUserMedia = function(constraints) {
						console.log('📹 getUserMedia called by Skyroom with:', JSON.stringify(constraints));
						
						// Use original constraints as-is - don't modify them
						return originalGetUserMedia(constraints)
							.then(function(stream) {
								console.log('✅ getUserMedia SUCCESS - stream received');
								console.log('- Video tracks:', stream.getVideoTracks().length);
								console.log('- Audio tracks:', stream.getAudioTracks().length);
								if (stream.getVideoTracks().length > 0) {
									stream.getVideoTracks().forEach(function(track) {
										console.log('  - Video track:', track.label, track.enabled ? 'enabled' : 'disabled');
									});
								}
								if (stream.getAudioTracks().length > 0) {
									stream.getAudioTracks().forEach(function(track) {
										console.log('  - Audio track:', track.label, track.enabled ? 'enabled' : 'disabled');
									});
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
									console.error('⚠️ Permission denied - check onPermissionRequest handler');
								} else if (error.name === 'NotFoundError') {
									console.error('⚠️ No camera/microphone found');
								} else if (error.name === 'NotReadableError') {
									console.error('⚠️ Camera/microphone is being used by another app');
								}
								
								throw error;
							});
					};
				} else {
					console.error('❌ navigator.mediaDevices.getUserMedia is not available!');
				}
				
				// Log available audio and video devices periodically
				if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
					setTimeout(function() {
						navigator.mediaDevices.enumerateDevices().then(function(devices) {
							const audioDevices = devices.filter(d => d.kind === 'audioinput');
							const videoDevices = devices.filter(d => d.kind === 'videoinput');
							console.log('📱 Available audio devices:', audioDevices.length);
							audioDevices.forEach(function(device) {
								console.log('- Audio Device:', device.kind, device.label || '(no label - permission needed)');
							});
							console.log('📹 Available video devices:', videoDevices.length);
							videoDevices.forEach(function(device) {
								console.log('- Video Device:', device.kind, device.label || '(no label - permission needed)');
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
	errorText: {
		fontSize: 16,
		color: '#ef4444',
		writingDirection: 'rtl',
		textAlign: 'center',
		padding: 20,
	},
	testHeader: {
		backgroundColor: '#1a1a1a',
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#333',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	testHeaderText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
		writingDirection: 'rtl',
	},
	proceedButton: {
		backgroundColor: '#10b981',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 6,
	},
	proceedButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		writingDirection: 'rtl',
	},
	testInfoContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
		backgroundColor: '#000',
	},
	testInfoText: {
		color: '#fff',
		fontSize: 16,
		textAlign: 'center',
		marginBottom: 20,
		lineHeight: 24,
		writingDirection: 'rtl',
	},
});

