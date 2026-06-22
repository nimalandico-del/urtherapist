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
} from 'react-native';
import { listMyTherapySessions, TherapySession } from '../api/client';

const { width } = Dimensions.get('window');

interface ConversationsScreenProps {
	navigation: any;
}

export default function ConversationsScreen({ navigation }: ConversationsScreenProps) {
	const [sessions, setSessions] = useState<TherapySession[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadSessions = async () => {
		try {
			setError(null);
			const data = await listMyTherapySessions();
			setSessions(data);
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
					<ActivityIndicator size="large" color="#2563eb" />
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
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
				}
			>
				{sessions.length === 0 && !error ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyIcon}>💬</Text>
						<Text style={styles.emptyText}>هنوز جلسه درمانی فعالی ندارید</Text>
					</View>
				) : (
					sessions.map((session, index) => (
						<TouchableOpacity
							key={`session-${session.id}-${index}`}
							style={styles.sessionCard}
							activeOpacity={0.8}
							onPress={() => {
								navigation.navigate('Chat', { sessionId: session.id });
							}}
						>
							<View style={styles.sessionHeader}>
								<View style={styles.sessionIconContainer}>
									<Text style={styles.sessionIcon}>💬</Text>
								</View>
								<View style={styles.sessionInfo}>
									<Text style={styles.sessionTitle}>{session.patient_name || 'بیمار'}</Text>
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
					))
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1e3a8a',
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
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#ffffff',
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
		color: '#ffffff',
		textAlign: 'right',
		writingDirection: 'rtl',
		flex: 1,
	},
	profileButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	profileButtonIcon: {
		fontSize: 20,
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#cbd5e1',
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	errorContainer: {
		margin: 20,
		padding: 16,
		backgroundColor: '#fee2e2',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#fca5a5',
	},
	errorText: {
		fontSize: 14,
		color: '#1e3a8a',
		textAlign: 'center',
		marginBottom: 12,
		writingDirection: 'rtl',
	},
	retryButton: {
		alignSelf: 'center',
		paddingVertical: 8,
		paddingHorizontal: 16,
		backgroundColor: '#2563eb',
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
		color: '#cbd5e1',
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	sessionCard: {
		backgroundColor: '#ffffff',
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
		borderRadius: 12,
		backgroundColor: '#dbeafe',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	sessionIcon: {
		fontSize: 24,
	},
	sessionInfo: {
		flex: 1,
	},
	sessionTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#1e3a8a',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	sessionLastMessage: {
		fontSize: 14,
		color: '#64748b',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	sessionDate: {
		fontSize: 12,
		color: '#94a3b8',
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
		backgroundColor: '#2563eb',
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
		color: '#2563eb',
		fontWeight: '600',
		writingDirection: 'rtl',
	},
});


