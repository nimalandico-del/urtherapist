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
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#2563eb" />
					<Text style={styles.loadingText}>در حال بارگذاری...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>پست‌ها</Text>
				<TouchableOpacity
					style={styles.createButton}
					onPress={() => navigation.navigate('CreatePost')}
					activeOpacity={0.7}
				>
					<Text style={styles.createButtonText}>+ ایجاد پست</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
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
		backgroundColor: '#f9fafb',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#6b7280',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 16,
		backgroundColor: '#fff',
		borderBottomWidth: 1,
		borderBottomColor: '#e5e7eb',
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#111827',
	},
	createButton: {
		backgroundColor: '#2563eb',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
	},
	createButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
	scrollContent: {
		padding: 16,
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
		color: '#6b7280',
		textAlign: 'center',
	},
	postCard: {
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 16,
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
		backgroundColor: '#2563eb',
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
		color: '#111827',
	},
	postDate: {
		fontSize: 12,
		color: '#6b7280',
		marginTop: 2,
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
		color: '#374151',
		lineHeight: 24,
		marginBottom: 12,
		textAlign: 'right',
	},
	reactionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: '#e5e7eb',
	},
	reactionButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 20,
		backgroundColor: '#f3f4f6',
	},
	reactionButtonActive: {
		backgroundColor: '#dbeafe',
	},
	reactionEmoji: {
		fontSize: 18,
		marginLeft: 4,
	},
	reactionCount: {
		fontSize: 14,
		color: '#374151',
		fontWeight: '600',
	},
});

