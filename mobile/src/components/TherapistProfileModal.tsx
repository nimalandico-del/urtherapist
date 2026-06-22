import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { get } from '../api/client';
import { getBucketFileUrl } from '../utils/storage';

interface Props {
  visible: boolean;
  therapistId?: number | null;
  initialProfile?: any | null;
  onClose: () => void;
}

export default function TherapistProfileModal({ visible, therapistId, initialProfile, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any | null>(initialProfile || null);

  useEffect(() => {
    setProfile(initialProfile || null);
  }, [initialProfile]);

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      if (profile) return;
      // If there is no therapistId but we have an initialProfile, use it
      if (!therapistId) {
        if (initialProfile) setProfile(initialProfile);
        return;
      }
      try {
        setLoading(true);
        const data = await get(`/therapists/${therapistId}/`);
        setProfile(data);
      } catch (e: any) {
        // If the public endpoint returned 404 (profile not found by id), fall back to initialProfile
        const status = e?.response?.status;
        if (status === 404) {
          if (initialProfile) {
            setProfile(initialProfile);
          } else {
            setProfile(null);
          }
        } else {
          console.error('Error loading therapist profile:', e);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [visible, therapistId]);

  const profileImage = profile?.profile_image_url ? getBucketFileUrl(profile.profile_image_url) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>پروفایل تراپیست</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {profileImage && (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: profileImage }} style={styles.image} />
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.label}>نام:</Text>
                <Text style={styles.value}>{profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`}</Text>
              </View>

              {profile?.bio ? (
                <View style={styles.bioContainer}>
                  <Text style={styles.label}>بیوگرافی:</Text>
                  <Text style={styles.bioText}>{profile.bio}</Text>
                </View>
              ) : null}

              {profile?.activity_categories && profile.activity_categories.length > 0 ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>حوزه‌ها:</Text>
                  <Text style={styles.value}>{profile.activity_categories.map((c: any) => c.display_name || c.name || c.name_fa).join(', ')}</Text>
                </View>
              ) : null}

              {profile?.specializations && profile.specializations.length > 0 ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>تخصص‌ها:</Text>
                  <Text style={styles.value}>{Array.isArray(profile.specializations) ? profile.specializations.join(', ') : String(profile.specializations)}</Text>
                </View>
              ) : null}

              {profile?.years_of_experience ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>سال‌های تجربه:</Text>
                  <Text style={styles.value}>{profile.years_of_experience} سال</Text>
                </View>
              ) : null}

              {profile?.education ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>تحصیلات:</Text>
                  <Text style={styles.value}>{profile.education}</Text>
                </View>
              ) : null}

              {profile?.certificates && profile.certificates.length > 0 ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>گواهینامه‌ها:</Text>
                  <Text style={styles.value}>{Array.isArray(profile.certificates) ? profile.certificates.join(', ') : String(profile.certificates)}</Text>
                </View>
              ) : null}

              {profile?.city ? (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>شهر:</Text>
                  <Text style={styles.value}>{profile.city}</Text>
                </View>
              ) : null}

              {(profile?.phone || profile?.email || profile?.address) && (
                <View style={styles.contactSection}>
                  <Text style={styles.sectionTitle}>اطلاعات تماس</Text>
                  {profile?.phone && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>شماره تماس:</Text>
                      <Text style={styles.value}>{profile.phone}</Text>
                    </View>
                  )}
                  {profile?.email && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>ایمیل:</Text>
                      <Text style={styles.value}>{profile.email}</Text>
                    </View>
                  )}
                  {profile?.address && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>آدرس:</Text>
                      <Text style={styles.value}>{profile.address}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.metaSection}>
                {profile?.is_approved !== undefined && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>تأیید:</Text>
                    <Text style={styles.value}>{profile.is_approved ? 'تأیید شده' : 'در انتظار تأیید'}</Text>
                  </View>
                )}
                {profile?.approved_at && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>تاریخ تأیید:</Text>
                    <Text style={styles.value}>{new Date(profile.approved_at).toLocaleString()}</Text>
                  </View>
                )}
                {profile?.created_at && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>عضویت:</Text>
                    <Text style={styles.value}>{new Date(profile.created_at).toLocaleDateString()}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
  },
  loadingWrap: {
    padding: 20,
  },
  content: {
    padding: 16,
  },
  imageWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    color: '#1f2937',
  },
  bioContainer: {
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: '#4a5568',
  },
  contactSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef2ff',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  metaSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});
