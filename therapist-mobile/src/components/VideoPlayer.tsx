import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Text } from 'react-native';

interface VideoPlayerProps {
	uri: string;
	style?: any;
}

const { width } = Dimensions.get('window');

export default function VideoPlayer({ uri, style }: VideoPlayerProps) {
	const videoRef = useRef<Video>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showControls, setShowControls] = useState(true);
	const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus | null>(null);

	useEffect(() => {
		// Hide controls after 3 seconds if playing
		if (isPlaying && showControls) {
			const timer = setTimeout(() => {
				setShowControls(false);
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [isPlaying, showControls]);

	useEffect(() => {
		// Cleanup: stop video when component unmounts
		return () => {
			if (videoRef.current) {
				videoRef.current.unloadAsync().catch(console.error);
			}
		};
	}, []);

	const togglePlayPause = async () => {
		if (videoRef.current) {
			try {
				if (isPlaying) {
					await videoRef.current.pauseAsync();
				} else {
					await videoRef.current.playAsync();
				}
			} catch (error) {
				console.error('Error toggling playback:', error);
			}
		}
		setShowControls(true);
	};

	const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
		setPlaybackStatus(status);
		if (status.isLoaded) {
			setIsLoading(false);
			setIsPlaying(status.isPlaying);
			if (status.didJustFinish) {
				setIsPlaying(false);
			}
		} else if (status.error) {
			console.error('Video playback error:', status.error);
			setIsLoading(false);
		}
	};

	const formatTime = (milliseconds: number) => {
		const seconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	};

	const getProgress = () => {
		if (playbackStatus?.isLoaded) {
			const { positionMillis, durationMillis } = playbackStatus;
			if (durationMillis) {
				return (positionMillis / durationMillis) * 100;
			}
		}
		return 0;
	};

	return (
		<View style={[styles.container, style]}>
			<TouchableOpacity
				style={styles.videoContainer}
				activeOpacity={1}
				onPress={togglePlayPause}
			>
				<Video
					ref={videoRef}
					source={{ uri }}
					style={styles.video}
					resizeMode={ResizeMode.CONTAIN}
					isLooping={false}
					shouldPlay={false}
					useNativeControls={false}
					onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
				/>

				{isLoading && (
					<View style={styles.loadingOverlay}>
						<ActivityIndicator size="large" color="#fff" />
					</View>
				)}

				{showControls && !isLoading && (
					<View style={styles.controlsOverlay}>
						<TouchableOpacity
							style={styles.playButton}
							onPress={togglePlayPause}
							activeOpacity={0.7}
						>
							<Text style={styles.playButtonIcon}>{isPlaying ? '⏸' : '▶'}</Text>
						</TouchableOpacity>
					</View>
				)}

				{playbackStatus?.isLoaded && (
					<View style={styles.progressContainer}>
						<View style={styles.progressBar}>
							<View style={[styles.progressFill, { width: `${getProgress()}%` }]} />
						</View>
						<View style={styles.timeContainer}>
							<Text style={styles.timeText}>
								{formatTime(playbackStatus.positionMillis || 0)} /{' '}
								{formatTime(playbackStatus.durationMillis || 0)}
							</Text>
						</View>
					</View>
				)}
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: '100%',
		backgroundColor: '#000',
		borderRadius: 8,
		overflow: 'hidden',
	},
	videoContainer: {
		width: '100%',
		height: 200,
		position: 'relative',
	},
	video: {
		width: '100%',
		height: '100%',
	},
	loadingOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	controlsOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.3)',
	},
	playButton: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: 'rgba(255, 255, 255, 0.9)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	playButtonIcon: {
		fontSize: 24,
		marginLeft: 4,
	},
	progressContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.7)',
		padding: 8,
	},
	progressBar: {
		height: 4,
		backgroundColor: 'rgba(255, 255, 255, 0.3)',
		borderRadius: 2,
		marginBottom: 4,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
		backgroundColor: '#4299e1',
	},
	timeContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	timeText: {
		color: '#fff',
		fontSize: 12,
	},
});

