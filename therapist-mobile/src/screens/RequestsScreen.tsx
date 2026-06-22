import React, { useEffect, useState, useRef } from 'react';
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
	Alert,
} from 'react-native';
import { getSessionRequests, SessionRequest, getWallet, Wallet } from '../api/client';
import { TherapistWebSocket } from '../api/websocket';

const { width } = Dimensions.get('window');

interface RequestsScreenProps {
	navigation: any;
}

export default function RequestsScreen({ navigation }: RequestsScreenProps) {
	const [requests, setRequests] = useState<SessionRequest[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [wallet, setWallet] = useState<Wallet | null>(null);
	const [walletError, setWalletError] = useState<string | null>(null);
	const wsRef = useRef<TherapistWebSocket | null>(null);

	const loadRequests = async () => {
		try {
			setError(null);
			const data = await getSessionRequests();
			setRequests(data);
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'خطا در بارگذاری درخواست‌ها');
			console.error('Error loading requests:', e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const loadWallet = async () => {
		try {
			setWalletError(null);
			const data = await getWallet();
			setWallet(data);
		} catch (e: any) {
			console.error('Error loading wallet:', e);
			setWalletError('خطا در دریافت کیف پول');
		}
	};

	useEffect(() => {
		loadRequests();
		loadWallet();

		// Setup WebSocket connection
		const ws = new TherapistWebSocket();
		wsRef.current = ws;

		ws.connect((message) => {
			if (message.type === 'new_request') {
				// Add new request to the list
				setRequests((prev) => [message.data, ...prev]);
				Alert.alert('درخواست جدید', `درخواست جدیدی از ${message.data.patient_name} دریافت شد`);
			} else if (message.type === 'request_updated') {
				// Update existing request
				setRequests((prev) =>
					prev.map((req) => (req.id === message.data.id ? message.data : req))
				);
			}
		});

		return () => {
			ws.disconnect();
		};
	}, []);

	const onRefresh = () => {
		setRefreshing(true);
		Promise.all([loadRequests(), loadWallet()]).finally(() => setRefreshing(false));
	};

	const formatRial = (value: number | undefined | null) =>
		new Intl.NumberFormat('fa-IR').format(value || 0);

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

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'PENDING':
				return { text: 'در انتظار', color: '#f59e0b', bg: '#fef3c7' };
			case 'APPROVED':
				return { text: 'تایید شده', color: '#10b981', bg: '#d1fae5' };
			case 'DENIED':
				return { text: 'رد شده', color: '#ef4444', bg: '#fee2e2' };
			default:
				return { text: status, color: '#6b7280', bg: '#f3f4f6' };
		}
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
					<Text style={styles.headerTitle}>درخواست‌های کاربران</Text>
				</View>
				<View style={styles.walletBar}>
					<Text style={styles.walletLabel}>کیف پول</Text>
					<View style={styles.walletValues}>
						<Text style={styles.walletAmount}>
							موجودی: {formatRial(wallet?.available_balance)} ریال
						</Text>
						<Text style={styles.walletReserved}>
							بلوکه: {formatRial(wallet?.reserved_balance)} ریال
						</Text>
					</View>
				</View>
				{walletError && <Text style={styles.walletError}>{walletError}</Text>}
				<Text style={styles.headerSubtitle}>لیست درخواست‌های ارسال شده</Text>
			</View>

			{error && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity onPress={loadRequests} style={styles.retryButton}>
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
				{requests.length === 0 && !error ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyIcon}>📋</Text>
						<Text style={styles.emptyText}>هنوز درخواستی ثبت نشده است</Text>
					</View>
				) : (
					requests.map((request, index) => {
						const statusBadge = getStatusBadge(request.status);
						return (
							<TouchableOpacity
								key={`request-${request.id}-${index}`}
								style={styles.requestCard}
								activeOpacity={0.8}
								onPress={() => {
									navigation.navigate('RequestDetail', { requestId: request.id });
								}}
							>
								<View style={styles.requestHeader}>
									<View style={styles.requestIconContainer}>
										<Text style={styles.requestIcon}>📝</Text>
									</View>
									<View style={styles.requestInfo}>
										<Text style={styles.requestTitle}>
											{request.psychological_issue_title || 'بدون عنوان'}
										</Text>
										<Text style={styles.requestUser}>
											کاربر: {request.patient_name || request.patient_phone}
										</Text>
										<Text style={styles.requestDate}>
											{formatDate(request.created_at)}
										</Text>
									</View>
								</View>
								<View style={styles.requestFooter}>
									<View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
										<Text style={[styles.statusText, { color: statusBadge.color }]}>
											{statusBadge.text}
										</Text>
									</View>
									<Text style={styles.viewDetails}>مشاهده جزئیات →</Text>
								</View>
							</TouchableOpacity>
						);
					})
				)}
			</ScrollView>

			<View style={styles.bottomNav}>
				<TouchableOpacity
					onPress={() => navigation.navigate('Posts')}
					style={styles.postsButton}
					activeOpacity={0.7}
				>
					<Text style={styles.postsButtonIcon}>📝</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() => navigation.navigate('Conversations')}
					style={styles.conversationsButton}
					activeOpacity={0.7}
				>
					<Text style={styles.conversationsButtonIcon}>💬</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() => navigation.navigate('Profile')}
					style={styles.profileButton}
					activeOpacity={0.7}
				>
					<Text style={styles.profileButtonIcon}>👤</Text>
				</TouchableOpacity>
			</View>
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
	headerButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	bottomNav: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 16,
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 28,
		backgroundColor: 'rgba(30, 41, 59, 0.92)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.14)',
	},
	conversationsButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	conversationsButtonIcon: {
		fontSize: 20,
	},
	profileButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	profileButtonIcon: {
		fontSize: 20,
	},
	postsButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	postsButtonIcon: {
		fontSize: 20,
	},
	walletBar: {
		marginTop: 8,
		padding: 12,
		borderRadius: 12,
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.15)',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	walletLabel: {
		color: '#e2e8f0',
		fontSize: 14,
		fontWeight: '700',
	},
	walletValues: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	walletAmount: {
		color: '#f8fafc',
		fontSize: 14,
		fontWeight: '700',
		marginLeft: 12,
	},
	walletReserved: {
		color: '#cbd5e0',
		fontSize: 13,
		fontWeight: '600',
		marginLeft: 12,
	},
	walletError: {
		color: '#fecaca',
		fontSize: 12,
		marginTop: 6,
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
		paddingBottom: 104,
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
	requestCard: {
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
	requestHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 12,
	},
	requestIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: '#dbeafe',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	requestIcon: {
		fontSize: 24,
	},
	requestInfo: {
		flex: 1,
	},
	requestTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#1e3a8a',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	requestUser: {
		fontSize: 14,
		color: '#475569',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	requestDate: {
		fontSize: 12,
		color: '#94a3b8',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	requestFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: '#e2e8f0',
	},
	statusBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
	},
	statusText: {
		fontSize: 12,
		fontWeight: '600',
	},
	viewDetails: {
		fontSize: 14,
		color: '#2563eb',
		fontWeight: '600',
		writingDirection: 'rtl',
	},
});
