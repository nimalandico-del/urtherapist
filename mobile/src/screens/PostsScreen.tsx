import React, { useState, useEffect } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
	Image,
	Alert,
} from 'react-native';
import { listPosts, addPostReaction, removePostReaction, Post } from '../api/client';
import VideoPlayer from '../components/VideoPlayer';
import { getBucketFileUrl } from '../utils/storage';

interface PostsScreenProps {
	navigation: any;
}

const REACTION_EMOJIS: Record<string, string> = {
	LIKE: '👍',
	LOVE: '❤️',
	SUPPORT: '🤝',
	THANKS: '🙏',
	INSIGHTFUL: '💡',
};

export default function PostsScreen({ navigation }: PostsScreenProps) {
	const [posts, setPosts] = useState<Post[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [reactingPostId, setReactingPostId] = useState<number | null>(null);

	useEffect(() => {
		loadPosts();
	}, []);

	const loadPosts = async () => {
		try {
			const data = await listPosts();
			setPosts(data);
		} catch (error: any) {
			Alert.alert('خطا', error?.response?.data?.detail || 'خطا در بارگذاری پست‌ها');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const onRefresh = () => {
		setRefreshing(true);
		loadPosts();
	};

	const handleReaction = async (postId: number, currentReaction: string | null) => {
		if (reactingPostId) return;
		
		setReactingPostId(postId);
		try {
			if (currentReaction) {
				// Remove reaction
				await removePostReaction(postId);
			} else {
				// Add like reaction by default
				await addPostReaction(postId, 'LIKE');
			}
			// Reload posts to get updated reactions
			await loadPosts();
		} catch (error: any) {
			Alert.alert('خطا', error?.response?.data?.detail || 'خطا در ثبت واکنش');
		} finally {
			setReactingPostId(null);
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('fa-IR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	const displayPosts = posts.map((post) => ({
		...post,
		therapist_profile_image_url: getBucketFileUrl(post.therapist_profile_image_url),
		image_url: getBucketFileUrl(post.image_url),
		video_url: getBucketFileUrl(post.video_url),
	}));

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.background}>
					<View style={styles.gradientCircle1} />
					<View style={styles.gradientCircle2} />
				</View>
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
					<Text style={styles.headerTitle}>پست‌های تراپیست‌ها</Text>
					<TouchableOpacity
						onPress={() => navigation.goBack()}
						style={styles.backButton}
						activeOpacity={0.7}
					>
						<Text style={styles.backButtonText}>←</Text>
					</TouchableOpacity>
				</View>
				<Text style={styles.headerSubtitle}>مشاهده پست‌های تراپیست‌ها</Text>
			</View>

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a5568" />
				}
			>
				{posts.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyIcon}>📝</Text>
						<Text style={styles.emptyText}>هنوز پستی ایجاد نشده است</Text>
					</View>
				) : (
					displayPosts.map((post) => (
						<View key={post.id} style={styles.postCard}>
							<View style={styles.postHeader}>
								{post.therapist_profile_image_url ? (
									<Image
										source={{ uri: post.therapist_profile_image_url }}
										style={styles.avatar}
									/>
								) : (
									<View style={styles.avatarPlaceholder}>
										<Text style={styles.avatarText}>
											{post.therapist_name.charAt(0)}
										</Text>
									</View>
								)}
								<View style={styles.postHeaderInfo}>
									<Text style={styles.therapistName}>{post.therapist_name}</Text>
									<Text style={styles.postDate}>{formatDate(post.created_at)}</Text>
								</View>
							</View>

							{post.post_type === 'IMAGE' && post.image_url && (
								<Image source={{ uri: post.image_url }} style={styles.postImage} />
							)}

							{post.post_type === 'VIDEO' && post.video_url && (
								<VideoPlayer uri={post.video_url} style={styles.videoPlayer} />
							)}

							<Text style={styles.postContent}>{post.content}</Text>

							<View style={styles.reactionsContainer}>
								<TouchableOpacity
									style={[
										styles.reactionButton,
										post.user_reaction && styles.reactionButtonActive,
									]}
									onPress={() => handleReaction(post.id, post.user_reaction?.reaction_type || null)}
									disabled={reactingPostId === post.id}
									activeOpacity={0.7}
								>
									<Text style={styles.reactionEmoji}>
										{post.user_reaction
											? REACTION_EMOJIS[post.user_reaction.reaction_type] || '👍'
											: '👍'}
									</Text>
									<Text style={styles.reactionCount}>{post.reactions_count || 0}</Text>
								</TouchableOpacity>
							</View>
						</View>
					))
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f7fafc',
	},
	background: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	gradientCircle1: {
		position: 'absolute',
		width: 300,
		height: 300,
		borderRadius: 150,
		backgroundColor: 'rgba(66, 153, 225, 0.1)',
		top: -100,
		right: -50,
	},
	gradientCircle2: {
		position: 'absolute',
		width: 200,
		height: 200,
		borderRadius: 100,
		backgroundColor: 'rgba(129, 140, 248, 0.1)',
		bottom: -50,
		left: -30,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#4a5568',
	},
	header: {
		padding: 20,
		paddingTop: 10,
		backgroundColor: 'rgba(255, 255, 255, 0.95)',
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	headerTop: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#1a202c',
		writingDirection: 'rtl',
	},
	backButton: {
		padding: 8,
	},
	backButtonText: {
		fontSize: 24,
		color: '#4a5568',
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#718096',
		textAlign: 'right',
		writingDirection: 'rtl',
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
		fontSize: 18,
		color: '#718096',
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	postCard: {
		backgroundColor: '#ffffff',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	postHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		marginLeft: 12,
	},
	avatarPlaceholder: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#4299e1',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	avatarText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	},
	postHeaderInfo: {
		flex: 1,
	},
	therapistName: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1a202c',
		writingDirection: 'rtl',
	},
	postDate: {
		fontSize: 12,
		color: '#718096',
		marginTop: 2,
		writingDirection: 'rtl',
	},
	postImage: {
		width: '100%',
		height: 200,
		borderRadius: 8,
		marginBottom: 12,
		resizeMode: 'cover',
	},
	videoPlayer: {
		marginBottom: 12,
	},
	postContent: {
		fontSize: 15,
		color: '#2d3748',
		lineHeight: 24,
		marginBottom: 12,
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	reactionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: '#e2e8f0',
	},
	reactionButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 20,
		backgroundColor: '#edf2f7',
	},
	reactionButtonActive: {
		backgroundColor: '#bee3f8',
	},
	reactionEmoji: {
		fontSize: 18,
		marginLeft: 4,
	},
	reactionCount: {
		fontSize: 14,
		color: '#2d3748',
		fontWeight: '600',
	},
});

