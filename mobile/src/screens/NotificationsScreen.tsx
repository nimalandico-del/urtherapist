import React, { useEffect, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
	Alert,
} from 'react-native';
import { listNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from '../api/client';

interface NotificationsScreenProps {
	navigation: {
		goBack: () => void;
	};
}

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const loadNotifications = async () => {
		try {
			const data = await listNotifications();
			setNotifications(data);
		} catch (error: any) {
			console.error('Error loading notifications:', error);
			Alert.alert('خطا', 'خطا در بارگذاری نوتیفیکیشن‌ها');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		loadNotifications();
	}, []);

	const handleMarkAsRead = async (notificationId: number) => {
		try {
			await markNotificationAsRead(notificationId);
			// Update local state
			setNotifications(prev =>
				prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
			);
		} catch (error: any) {
			console.error('Error marking notification as read:', error);
		}
	};

	const handleMarkAllAsRead = async () => {
		try {
			await markAllNotificationsAsRead();
			// Update local state
			setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
			Alert.alert('موفق', 'همه نوتیفیکیشن‌ها به عنوان خوانده شده علامت‌گذاری شدند');
		} catch (error: any) {
			console.error('Error marking all as read:', error);
			Alert.alert('خطا', 'خطا در علامت‌گذاری نوتیفیکیشن‌ها');
		}
	};

	const unreadCount = notifications.filter(n => !n.is_read).length;

	if (loading) {
		return (
			<View style={styles.container}>
				<View style={styles.header}>
					<TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
						<Text style={styles.backButtonText}>← بازگشت</Text>
					</TouchableOpacity>
					<Text style={styles.headerTitle}>نوتیفیکیشن‌ها</Text>
					<View style={styles.placeholder} />
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#417690" />
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
					<Text style={styles.backButtonText}>← بازگشت</Text>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>نوتیفیکیشن‌ها</Text>
				{unreadCount > 0 && (
					<TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
						<Text style={styles.markAllButtonText}>خوانده شده ({unreadCount})</Text>
					</TouchableOpacity>
				)}
				{unreadCount === 0 && <View style={styles.placeholder} />}
			</View>

			<ScrollView
				style={styles.scrollView}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={loadNotifications} />
				}
			>
				{notifications.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyText}>هیچ نوتیفیکیشنی وجود ندارد</Text>
					</View>
				) : (
					notifications.map(notification => (
						<TouchableOpacity
							key={notification.id}
							style={[
								styles.notificationCard,
								!notification.is_read && styles.unreadCard,
							]}
							onPress={() => handleMarkAsRead(notification.id)}
						>
							<View style={styles.notificationHeader}>
								<Text style={styles.notificationTitle}>{notification.title}</Text>
								{!notification.is_read && <View style={styles.unreadDot} />}
							</View>
							<Text style={styles.notificationMessage}>{notification.message}</Text>
							<Text style={styles.notificationDate}>
								{new Date(notification.sent_at).toLocaleDateString('fa-IR', {
									year: 'numeric',
									month: 'long',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
								})}
							</Text>
							{notification.sent_by_username && (
								<Text style={styles.notificationSender}>
									ارسال شده توسط: {notification.sent_by_username}
								</Text>
							)}
						</TouchableOpacity>
					))
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f5f5',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 15,
		backgroundColor: '#417690',
		paddingTop: 50,
	},
	backButton: {
		padding: 5,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 16,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#fff',
	},
	markAllButton: {
		padding: 5,
	},
	markAllButtonText: {
		color: '#fff',
		fontSize: 14,
	},
	placeholder: {
		width: 60,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	scrollView: {
		flex: 1,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 40,
	},
	emptyText: {
		fontSize: 16,
		color: '#666',
		textAlign: 'center',
	},
	notificationCard: {
		backgroundColor: '#fff',
		margin: 10,
		padding: 15,
		borderRadius: 8,
		borderLeftWidth: 4,
		borderLeftColor: '#417690',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	unreadCard: {
		backgroundColor: '#e3f2fd',
		borderLeftColor: '#2196f3',
	},
	notificationHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	notificationTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333',
		flex: 1,
	},
	unreadDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: '#2196f3',
		marginLeft: 10,
	},
	notificationMessage: {
		fontSize: 14,
		color: '#666',
		marginBottom: 10,
		lineHeight: 20,
	},
	notificationDate: {
		fontSize: 12,
		color: '#999',
		marginTop: 5,
	},
	notificationSender: {
		fontSize: 12,
		color: '#999',
		marginTop: 5,
		fontStyle: 'italic',
	},
});

