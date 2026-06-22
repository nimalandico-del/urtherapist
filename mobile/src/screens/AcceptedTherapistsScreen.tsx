import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { getSessionRequests, getSessionRequest, listMyTherapySessions, acceptSessionRequestOffer, rejectSessionRequestOffer } from '../api/client';
import { getBucketFileUrl } from '../utils/storage';

const { width } = Dimensions.get('window');

interface AcceptedTherapistsScreenProps {
  navigation: any;
}

interface TherapistOfferData {
  requestId: number;
  offerId: number;
  requestTitle: string;
  therapistId: number;
  therapistName: string;
  price: number;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

function formatPrice(value: number) {
  return `${value.toLocaleString('fa-IR')} ریال`;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fa-IR');
}

export default function AcceptedTherapistsScreen({ navigation }: AcceptedTherapistsScreenProps) {
  const handleAcceptOffer = async (offer: TherapistOfferData) => {
    Alert.alert(
      'تأیید پیشنهاد',
      `آیا می‌خواهید پیشنهاد ${offer.therapistName} را تایید کنید؟`,
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'تایید',
          onPress: async () => {
            try {
              await acceptSessionRequestOffer(offer.requestId, offer.offerId);
              Alert.alert('موفقیت', 'پیشنهاد قبول شد. می‌توانید چت را شروع کنید.', [{ text: 'باشه' }]);
              loadAcceptedOffers();
              setTimeout(() => {
                navigation.navigate('Chat', { requestId: offer.requestId });
              }, 500);
            } catch (e: any) {
              Alert.alert('خطا', e?.response?.data?.detail || 'خطا در قبول پیشنهاد');
              console.error('Error accepting offer:', e);
            }
          },
        },
      ]
    );
  };

  const handleRejectOffer = async (offer: TherapistOfferData) => {
    Alert.alert(
      'رد پیشنهاد',
      `آیا می‌خواهید پیشنهاد ${offer.therapistName} را رد کنید؟`,
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'رد',
          onPress: async () => {
            try {
              await rejectSessionRequestOffer(offer.requestId, offer.offerId);
              Alert.alert('موفقیت', 'پیشنهاد رد شد.', [{ text: 'باشه' }]);
              loadAcceptedOffers();
            } catch (e: any) {
              Alert.alert('خطا', e?.response?.data?.detail || 'خطا در رد پیشنهاد');
              console.error('Error rejecting offer:', e);
            }
          },
        },
      ]
    );
  };
  const [acceptedOffers, setAcceptedOffers] = useState<TherapistOfferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAcceptedOffers();
  }, []);

  const loadAcceptedOffers = async () => {
    try {
      setLoading(true);
      setError(null);
      const offers: TherapistOfferData[] = [];

      // Fetch all session requests to find pending and accepted offers
      const requests = await getSessionRequests();
      for (const request of requests) {
        if (request.offers && Array.isArray(request.offers)) {
          for (const offer of request.offers) {
            if (offer.status === 'PENDING' || offer.status === 'ACCEPTED') {
              offers.push({
                requestId: request.id,
                offerId: offer.id,
                requestTitle: request.psychological_issue_title,
                therapistId: offer.therapist_id,
                therapistName: offer.therapist_name,
                price: offer.price,
                message: offer.message,
                status: offer.status,
                createdAt: offer.created_at,
              });
            }
          }
        }
      }
      
      // Sort by created date (newest first)
      offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAcceptedOffers(offers);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'خطا در بارگذاری لیست پیشنهادهای تراپیست');
      console.error('Error loading accepted offers:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.background}>
          <View style={styles.gradientCircle1} />
          <View style={styles.gradientCircle2} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>در حال بارگذاری...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.background}>
          <View style={styles.gradientCircle1} />
          <View style={styles.gradientCircle2} />
        </View>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تراپیست‌های قبول‌کننده</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAcceptedOffers}>
            <Text style={styles.retryButtonText}>تلاش دوباره</Text>
          </TouchableOpacity>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>پیشنهادهای تراپیست</Text>
      </View>

      {acceptedOffers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>هیچ پیشنهادی دریافت نشده</Text>
          <Text style={styles.emptyText}>وقتی تراپیستی پیشنهاد قیمتی ارسال کند، اینجا نمایش داده خواهد شد.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {acceptedOffers.map((offer, index) => (
            <View key={`${offer.requestId}-${offer.offerId}-${index}`} style={[styles.offerCard, offer.status === 'PENDING' && styles.offerCardPending]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.therapistName}>{offer.therapistName}</Text>
                  <Text style={styles.issueTitle}>{offer.requestTitle}</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceLabel}>قیمت</Text>
                  <Text style={styles.price}>{formatPrice(offer.price)}</Text>
                </View>
              </View>

              {offer.message && (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageLabel}>پیام تراپیست:</Text>
                  <Text style={styles.messageText}>{offer.message}</Text>
                </View>
              )}

              {offer.status === 'PENDING' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.acceptButton]}
                    onPress={() => handleAcceptOffer(offer)}
                  >
                    <Text style={styles.buttonText}>✓ قبول</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => handleRejectOffer(offer)}
                  >
                    <Text style={styles.buttonText}>✕ رد</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>📅 {formatDate(offer.createdAt)}</Text>
                <View style={offer.status === 'ACCEPTED' ? styles.statusBadgeAccepted : styles.statusBadgePending}>
                  <Text style={offer.status === 'ACCEPTED' ? styles.statusTextAccepted : styles.statusTextPending}>
                    {offer.status === 'ACCEPTED' ? '✓ قبول‌شده' : '⏳ در انتظار تایید'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  backIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'right',
    writingDirection: 'rtl',
    flex: 1,
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
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
    writingDirection: 'rtl',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    writingDirection: 'rtl',
  },
  emptyText: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  offerCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  therapistName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 4,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  issueTitle: {
    fontSize: 14,
    color: '#64748b',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  priceTag: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
    marginBottom: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  messageContainer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  messageLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  messageText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  offerCardPending: {
    borderTopWidth: 4,
    borderTopColor: '#fbbf24',
  },
  statusBadgeAccepted: {
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusTextAccepted: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  statusTextPending: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
});
