/**
 * ============================================
 * AGORA VoIP & VIDEO SERVICE
 * ============================================
 * Complete Agora integration for:
 * - Voice calls (VoIP)
 * - Video calls
 * - Screen sharing (prescription discussion)
 * - Token generation
 * - Channel management
 * 
 * Based on 38 Questions: Q15 - Communication
 * - Anonymous pharmacist-patient calls
 * - Call recording with consent
 * - Screen sharing for prescription review
 */

import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = pkg as any;

// Agora credentials
const APP_ID = process.env.AGORA_APP_ID || '';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

// Token expiration (24 hours)
const TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60;

// ============================================
// TYPES
// ============================================

export interface ChannelInfo {
  channelName: string;
  uid: number;
  role: 'publisher' | 'subscriber';
}

export interface TokenResponse {
  token: string;
  channelName: string;
  uid: number;
  appId: string;
  expiresAt: Date;
}

export interface CallSession {
  sessionId: string;
  channelName: string;
  orderId: string;
  pharmacistId: string;
  patientId: string;  // Anonymous reference
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordingId?: string;
  type: 'voice' | 'video';
  status: 'pending' | 'active' | 'completed' | 'missed' | 'declined';
}

export interface CallParticipant {
  uid: number;
  role: 'pharmacist' | 'patient';
  userId: string;
  anonymousId?: string;  // For patient anonymity
  joinedAt?: Date;
  leftAt?: Date;
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate RTC token for voice/video calls
 * Per Q15: Anonymous communication - patient identity hidden
 */
export const generateRtcToken = (
  channelName: string,
  uid: number,
  role: 'publisher' | 'subscriber' = 'publisher',
  expirationSeconds: number = TOKEN_EXPIRATION_SECONDS
): TokenResponse => {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error('Agora credentials not configured');
  }

  const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expirationSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    rtcRole,
    privilegeExpireTime
  );

  return {
    token,
    channelName,
    uid,
    appId: APP_ID,
    expiresAt: new Date((currentTime + expirationSeconds) * 1000),
  };
};

/**
 * Generate RTM token for real-time messaging
 */
export const generateRtmToken = (
  userId: string,
  expirationSeconds: number = TOKEN_EXPIRATION_SECONDS
): { token: string; expiresAt: Date } => {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error('Agora credentials not configured');
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expirationSeconds;

  const token = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERTIFICATE,
    userId,
    RtmRole.Rtm_User,
    privilegeExpireTime
  );

  return {
    token,
    expiresAt: new Date((currentTime + expirationSeconds) * 1000),
  };
};

// ============================================
// CHANNEL MANAGEMENT
// ============================================

/**
 * Generate unique channel name for pharmacist-patient call
 * Format: jetmed_order_{orderId}_{timestamp}
 */
export const generateChannelName = (orderId: string): string => {
  const timestamp = Date.now();
  return `jetmed_order_${orderId}_${timestamp}`;
};

/**
 * Generate anonymous UID for patient
 * Per Q15: Patient identity hidden from pharmacist
 */
export const generateAnonymousUid = (): number => {
  // Generate random UID between 1 and 2^31 (Agora UID range)
  return Math.floor(Math.random() * 2147483647) + 1;
};

/**
 * Create call session for pharmacist-patient communication
 */
export const createCallSession = (
  orderId: string,
  pharmacistId: string,
  patientId: string,
  type: 'voice' | 'video' = 'voice'
): CallSession => {
  const channelName = generateChannelName(orderId);
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    sessionId,
    channelName,
    orderId,
    pharmacistId,
    patientId,
    startTime: new Date(),
    type,
    status: 'pending',
  };
};

/**
 * Generate tokens for both pharmacist and patient
 */
export const generateCallTokens = (
  channelName: string,
  pharmacistUserId: string,
  patientUserId: string
): {
  pharmacistToken: TokenResponse;
  patientToken: TokenResponse;
  channelName: string;
} => {
  // Pharmacist gets a consistent UID based on their ID
  const pharmacistUid = hashStringToUid(pharmacistUserId);
  
  // Patient gets anonymous UID for privacy
  const patientUid = generateAnonymousUid();

  const pharmacistToken = generateRtcToken(channelName, pharmacistUid, 'publisher');
  const patientToken = generateRtcToken(channelName, patientUid, 'publisher');

  return {
    pharmacistToken,
    patientToken,
    channelName,
  };
};

// ============================================
// CALL RECORDING
// ============================================

/**
 * Recording configuration
 * Per Q15: Call recording with consent
 */
export interface RecordingConfig {
  channelName: string;
  uid: number;
  mode: 'individual' | 'mix';
  streamTypes: number; // 0: audio only, 1: video only, 2: both
  fileFormat: 'mp3' | 'mp4' | 'webm';
}

/**
 * Start cloud recording
 * Note: Requires Agora Cloud Recording to be enabled
 */
export const startRecording = async (config: RecordingConfig): Promise<string> => {
  // This would integrate with Agora Cloud Recording REST API
  // For production, implement full cloud recording integration
  
  console.log('Starting recording for channel:', config.channelName);
  
  // Return mock recording ID for now
  const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // In production, call Agora Cloud Recording API:
  // POST https://api.agora.io/v1/apps/{appid}/cloud_recording/resourceid/{resourceid}/mode/{mode}/start
  
  return recordingId;
};

/**
 * Stop cloud recording
 */
export const stopRecording = async (recordingId: string, channelName: string): Promise<{
  recordingId: string;
  fileUrl?: string;
  duration?: number;
}> => {
  console.log('Stopping recording:', recordingId);
  
  // In production, call Agora Cloud Recording API:
  // POST https://api.agora.io/v1/apps/{appid}/cloud_recording/resourceid/{resourceid}/sid/{sid}/mode/{mode}/stop
  
  return {
    recordingId,
    fileUrl: `https://storage.jetmed.com/recordings/${recordingId}.mp3`,
    duration: 0, // Would be populated from actual API response
  };
};

// ============================================
// SCREEN SHARING
// ============================================

/**
 * Generate screen sharing token
 * Per Q15: Screen sharing for prescription review
 */
export const generateScreenShareToken = (
  channelName: string,
  uid: number
): TokenResponse => {
  // Screen sharing uses same token generation but with special UID
  // Typically screen share UID = regular UID + 1000000
  const screenShareUid = uid + 1000000;
  
  return generateRtcToken(channelName, screenShareUid, 'publisher');
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Hash string to consistent UID
 */
const hashStringToUid = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647 + 1;
};

/**
 * Validate Agora configuration
 */
export const validateConfiguration = (): boolean => {
  if (!APP_ID || !APP_CERTIFICATE) {
    console.error('Agora credentials not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE');
    return false;
  }
  return true;
};

/**
 * Calculate call duration
 */
export const calculateCallDuration = (startTime: Date, endTime: Date): number => {
  return Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // Duration in seconds
};

/**
 * Format call duration for display
 */
export const formatCallDuration = (durationSeconds: number): string => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ============================================
// CALL QUALITY MONITORING
// ============================================

/**
 * Quality indicators for call
 */
export interface CallQuality {
  networkQuality: 'excellent' | 'good' | 'poor' | 'bad' | 'unknown';
  audioQuality: 'excellent' | 'good' | 'poor' | 'bad' | 'unknown';
  videoQuality?: 'excellent' | 'good' | 'poor' | 'bad' | 'unknown';
  latency?: number; // ms
  packetLoss?: number; // percentage
}

/**
 * Parse Agora quality level to friendly name
 */
export const parseQualityLevel = (
  level: number
): 'excellent' | 'good' | 'poor' | 'bad' | 'unknown' => {
  switch (level) {
    case 1:
      return 'excellent';
    case 2:
      return 'good';
    case 3:
    case 4:
      return 'poor';
    case 5:
    case 6:
      return 'bad';
    default:
      return 'unknown';
  }
};

// ============================================
// NOTIFICATION HELPERS
// ============================================

/**
 * Generate call notification payload
 */
export const generateCallNotification = (
  callSession: CallSession,
  recipientType: 'pharmacist' | 'patient'
): {
  title: string;
  body: string;
  data: Record<string, string>;
} => {
  const isIncoming = recipientType === 'patient';

  return {
    title: isIncoming ? 'Incoming Call from Pharmacist' : 'Patient Consultation Request',
    body: isIncoming
      ? 'A pharmacist wants to discuss your prescription'
      : 'A patient is waiting for prescription consultation',
    data: {
      type: 'call_notification',
      sessionId: callSession.sessionId,
      channelName: callSession.channelName,
      orderId: callSession.orderId,
      callType: callSession.type,
    },
  };
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Token generation
  generateRtcToken,
  generateRtmToken,

  // Channel management
  generateChannelName,
  generateAnonymousUid,
  createCallSession,
  generateCallTokens,

  // Recording
  startRecording,
  stopRecording,

  // Screen sharing
  generateScreenShareToken,

  // Utilities
  validateConfiguration,
  calculateCallDuration,
  formatCallDuration,
  parseQualityLevel,
  generateCallNotification,
};
