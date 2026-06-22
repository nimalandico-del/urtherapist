import React, { useState, useEffect } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Alert,
	ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Platform } from 'react-native';

interface CameraTestScreenProps {
	navigation: any;
}

export default function CameraTestScreen({ navigation }: CameraTestScreenProps) {
	const [permission, requestPermission] = useCameraPermissions();
	const [facing, setFacing] = useState<CameraType>('back');
	const [isRequesting, setIsRequesting] = useState(false);

	// Request permission immediately when screen loads
	useEffect(() => {
		const requestCameraPermission = async () => {
			if (!permission) {
				setIsRequesting(true);
				try {
					const result = await requestPermission();
					console.log('Camera permission result:', result);
					if (!result.granted) {
						Alert.alert(
							'Camera Permission Required',
							'This app needs camera permission to function. Please grant permission in device settings.',
							[
								{ text: 'Cancel', onPress: () => navigation.goBack(), style: 'cancel' },
								{ text: 'Try Again', onPress: requestCameraPermission },
							]
						);
					}
				} catch (error) {
					console.error('Error requesting camera permission:', error);
					Alert.alert('Error', 'Failed to request camera permission');
				} finally {
					setIsRequesting(false);
				}
			}
		};

		requestCameraPermission();
	}, []);

	const handleRequestPermission = async () => {
		setIsRequesting(true);
		try {
			const result = await requestPermission();
			console.log('Camera permission result:', result);
			if (!result.granted) {
				Alert.alert(
					'Permission Denied',
					'Camera permission was denied. Please enable it in device settings to use this feature.',
					[
						{ text: 'OK', style: 'cancel' },
						{ text: 'Try Again', onPress: handleRequestPermission },
					]
				);
			}
		} catch (error) {
			console.error('Error requesting camera permission:', error);
			Alert.alert('Error', 'Failed to request camera permission');
		} finally {
			setIsRequesting(false);
		}
	};

	const toggleCameraFacing = () => {
		setFacing(current => (current === 'back' ? 'front' : 'back'));
	};

	if (!permission) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.content}>
					<Text style={styles.title}>Camera Permission Test</Text>
					<Text style={styles.subtitle}>
						Requesting camera permission...
					</Text>
					<ActivityIndicator size="large" color="#4a5568" style={styles.loader} />
				</View>
			</SafeAreaView>
		);
	}

	if (!permission.granted) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.content}>
					<Text style={styles.icon}>📷</Text>
					<Text style={styles.title}>Camera Permission Required</Text>
					<Text style={styles.subtitle}>
						This test page requests camera permission at the device level.
						{'\n\n'}
						When you tap the button below, your device will show a native permission dialog asking for camera access.
					</Text>
					
					<View style={styles.statusContainer}>
						<Text style={styles.statusLabel}>Permission Status:</Text>
						<Text style={[styles.statusValue, styles.statusDenied]}>
							{permission.granted ? 'Granted' : 'Not Granted'}
						</Text>
					</View>

					<TouchableOpacity
						style={[styles.button, isRequesting && styles.buttonDisabled]}
						onPress={handleRequestPermission}
						disabled={isRequesting}
						activeOpacity={0.8}
					>
						{isRequesting ? (
							<ActivityIndicator color="#fff" size="small" />
						) : (
							<Text style={styles.buttonText}>Request Camera Permission</Text>
						)}
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
						activeOpacity={0.7}
					>
						<Text style={styles.backButtonText}>← Back</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.cameraContainer}>
				<CameraView
					style={styles.camera}
					facing={facing}
				>
					<View style={styles.cameraOverlay}>
						<View style={styles.header}>
							<TouchableOpacity
								style={styles.closeButton}
								onPress={() => navigation.goBack()}
								activeOpacity={0.7}
							>
								<Text style={styles.closeButtonText}>← Back</Text>
							</TouchableOpacity>
						</View>
						
						<View style={styles.controls}>
							<TouchableOpacity
								style={styles.flipButton}
								onPress={toggleCameraFacing}
								activeOpacity={0.7}
							>
								<Text style={styles.flipButtonText}>🔄 Flip Camera</Text>
							</TouchableOpacity>
						</View>

						<View style={styles.statusBadge}>
							<Text style={styles.statusBadgeText}>
								✅ Camera Permission: Granted
							</Text>
						</View>
					</View>
				</CameraView>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#2d3748',
	},
	content: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	icon: {
		fontSize: 64,
		marginBottom: 20,
	},
	title: {
		fontSize: 28,
		fontWeight: '800',
		color: '#f7fafc',
		textAlign: 'center',
		marginBottom: 12,
	},
	subtitle: {
		fontSize: 16,
		color: '#a0aec0',
		textAlign: 'center',
		marginBottom: 32,
		lineHeight: 24,
	},
	statusContainer: {
		backgroundColor: '#4a5568',
		padding: 16,
		borderRadius: 12,
		marginBottom: 24,
		width: '100%',
		maxWidth: 300,
	},
	statusLabel: {
		fontSize: 14,
		color: '#a0aec0',
		marginBottom: 8,
	},
	statusValue: {
		fontSize: 18,
		fontWeight: '700',
	},
	statusGranted: {
		color: '#48bb78',
	},
	statusDenied: {
		color: '#f56565',
	},
	button: {
		backgroundColor: '#4a5568',
		paddingVertical: 16,
		paddingHorizontal: 32,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minWidth: 200,
		shadowColor: '#000',
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
	},
	backButton: {
		marginTop: 24,
		paddingVertical: 12,
		paddingHorizontal: 24,
	},
	backButtonText: {
		color: '#a0aec0',
		fontSize: 16,
		fontWeight: '600',
	},
	loader: {
		marginTop: 20,
	},
	cameraContainer: {
		flex: 1,
	},
	camera: {
		flex: 1,
	},
	cameraOverlay: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	header: {
		padding: 20,
		paddingTop: 40,
	},
	closeButton: {
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignSelf: 'flex-start',
	},
	closeButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	controls: {
		position: 'absolute',
		bottom: 40,
		left: 0,
		right: 0,
		alignItems: 'center',
	},
	flipButton: {
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 8,
	},
	flipButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	statusBadge: {
		position: 'absolute',
		top: 100,
		left: 20,
		right: 20,
		backgroundColor: 'rgba(72, 187, 120, 0.9)',
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	statusBadgeText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
});

