import React, { useEffect, useState } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
	Dimensions,
	Image,
} from 'react-native';
import { listMyTherapySessions, TherapySession } from '../api/client';
import TherapistProfileModal from '../components/TherapistProfileModal';
import { getBucketFileUrl } from '../utils/storage';

const { width } = Dimensions.get('window');

interface ConversationsScreenProps {
	navigation: any;
}

export default function ConversationsScreen({ navigation }: ConversationsScreenProps) {
	const [sessions, setSessions] = useState<TherapySession[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
	const [modalVisible, setModalVisible] = useState(false);
	const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(null);
	const [selectedInitialProfile, setSelectedInitialProfile] = useState<any | null>(null);

	const loadSessions = async () => {
		try {
			setError(null);
			const data = await listMyTherapySessions();
			setSessions(
				data.map((session) => ({
					...session,
					therapist_profile_image_url: getBucketFileUrl(session.therapist_profile_image_url),
				})),
			);
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'خطا در بارگذاری جلسات');
			console.error('Error loading sessions:', e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		loadSessions();
	}, []);

	const onRefresh = () => {
		setRefreshing(true);
		loadSessions();
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('fa-IR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#4a5568" />
					<Text style={styles.loadingText}>در حال بارگذاری...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.background}>
				<View style={styles.gradientCircle1} />
				<View style={styles.gradientCircle2} />
			</View>

			<View style={styles.header}>
				<View style={styles.headerTop}>
					<Text style={styles.headerTitle}>جلسات درمانی</Text>
					<TouchableOpacity
						onPress={() => navigation.navigate('Profile')}
						style={styles.profileButton}
						activeOpacity={0.7}
					>
						<Text style={styles.profileButtonIcon}>👤</Text>
					</TouchableOpacity>
				</View>
				<Text style={styles.headerSubtitle}>لیست گفتگوهای فعال</Text>
			</View>

			{error && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity onPress={loadSessions} style={styles.retryButton}>
						<Text style={styles.retryButtonText}>تلاش مجدد</Text>
					</TouchableOpacity>
				</View>
			)}

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a5568" />
				}
			>
				{sessions.length === 0 && !error ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyIcon}>💬</Text>
						<Text style={styles.emptyText}>هنوز جلسه درمانی فعالی ندارید</Text>
					</View>
				) : (
					sessions.map((session, index) => {
						const therapistName = session.therapist_name || 'درمانگر';
						const showProfileImage =
							session.therapist_profile_image_url && !failedImages.has(session.id);

						return (
						<TouchableOpacity
							key={`session-${session.id}-${index}`}
							style={styles.sessionCard}
							activeOpacity={0.8}
							onPress={() => {
								navigation.navigate('Chat', { sessionId: session.id });
							}}
						>
							<View style={styles.sessionHeader}>
								{showProfileImage ? (
									<TouchableOpacity
										activeOpacity={0.8}
										onPress={() => {
											setSelectedTherapistId(session.therapist_profile_id ?? session.therapist);
											setSelectedInitialProfile({ full_name: therapistName, profile_image_url: session.therapist_profile_image_url });
											setModalVisible(true);
										}}
									>
										<Image
											source={{ uri: session.therapist_profile_image_url! }}
											style={styles.sessionAvatar}
											resizeMode="cover"
											onError={() => {
												setFailedImages((prev) => new Set(prev).add(session.id));
											}}
										/>
									</TouchableOpacity>
								) : (
									<View style={styles.sessionIconContainer}>
										<Text style={styles.sessionAvatarText}>
											{therapistName.charAt(0)}
										</Text>
									</View>
								)}
								<View style={styles.sessionInfo}>
									<Text style={styles.sessionTitle}>{therapistName}</Text>
									{session.latest_message && (
										<Text style={styles.sessionLastMessage} numberOfLines={1}>
											{session.latest_message.content}
										</Text>
									)}
									<Text style={styles.sessionDate}>
										{formatDate(session.started_at)}
									</Text>
								</View>
							</View>
							<View style={styles.sessionFooter}>
								{session.unread_count > 0 && (
									<View style={styles.unreadBadge}>
										<Text style={styles.unreadText}>{session.unread_count}</Text>
									</View>
								)}
								<Text style={styles.viewChat}>مشاهده گفتگو →</Text>
							</View>
						</TouchableOpacity>
						);
					})
				)}
			</ScrollView>

			<TherapistProfileModal
				visible={modalVisible}
				therapistId={selectedTherapistId}
				initialProfile={selectedInitialProfile}
				onClose={() => setModalVisible(false)}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#2d3748',
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
		backgroundColor: '#4a5568',
		opacity: 0.15,
		top: -width * 0.3,
		right: -width * 0.3,
	},
	gradientCircle2: {
		position: 'absolute',
		width: width * 0.8,
		height: width * 0.8,
		borderRadius: width * 0.4,
		backgroundColor: '#718096',
		opacity: 0.1,
		bottom: -width * 0.2,
		left: -width * 0.2,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#a0aec0',
		writingDirection: 'rtl',
		textAlign: 'center',
	},
	header: {
		padding: 20,
		paddingTop: 16,
		paddingBottom: 8,
	},
	headerTop: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: '800',
		color: '#f7fafc',
		textAlign: 'right',
		writingDirection: 'rtl',
		flex: 1,
	},
	profileButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.15)',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	profileButtonIcon: {
		fontSize: 20,
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#a0aec0',
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	errorContainer: {
		margin: 20,
		padding: 16,
		backgroundColor: '#f7e8e8',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e2a0a0',
	},
	errorText: {
		fontSize: 14,
		color: '#2d3748',
		textAlign: 'center',
		marginBottom: 12,
		writingDirection: 'rtl',
	},
	retryButton: {
		alignSelf: 'center',
		paddingVertical: 8,
		paddingHorizontal: 16,
		backgroundColor: '#4a5568',
		borderRadius: 8,
	},
	retryButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
	scrollContent: {
		padding: 20,
		paddingTop: 8,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyIcon: {
		fontSize: 64,
		marginBottom: 16,
	},
	emptyText: {
		fontSize: 16,
		color: '#a0aec0',
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	sessionCard: {
		backgroundColor: '#f7fafc',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	sessionHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 12,
	},
	sessionIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: '#4a5568',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	sessionAvatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		marginLeft: 12,
		backgroundColor: '#e2e8f0',
	},
	sessionAvatarText: {
		fontSize: 20,
		fontWeight: '700',
		color: '#f7fafc',
	},
	sessionInfo: {
		flex: 1,
	},
	sessionTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#2d3748',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	sessionLastMessage: {
		fontSize: 14,
		color: '#718096',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	sessionDate: {
		fontSize: 12,
		color: '#a0aec0',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	sessionFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: '#e2e8f0',
	},
	unreadBadge: {
		backgroundColor: '#4a5568',
		borderRadius: 12,
		paddingHorizontal: 8,
		paddingVertical: 4,
		minWidth: 24,
		alignItems: 'center',
		justifyContent: 'center',
	},
	unreadText: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '700',
	},
	viewChat: {
		fontSize: 14,
		color: '#4a5568',
		fontWeight: '600',
		writingDirection: 'rtl',
	},
});

