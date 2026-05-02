// ═══════════════════════════════════════════════════════════════════════════════
// JetMed - Agora Voice/Video Service (Frontend)
// ═══════════════════════════════════════════════════════════════════════════════

import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
} from 'agora-rtc-sdk-ng';
import api from './api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CallType = 'voice' | 'video';
export type CallRole = 'patient' | 'pharmacist';

export interface CallSession {
  channelName: string;
  token: string;
  uid: number;
  appId: string;
}

export interface CallState {
  isConnected: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  remoteUsers: IAgoraRTCRemoteUser[];
  duration: number;
  networkQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

let client: IAgoraRTCClient | null = null;
let localAudioTrack: IMicrophoneAudioTrack | null = null;
let localVideoTrack: ICameraVideoTrack | null = null;

/**
 * Get or create Agora client
 */
const getClient = (): IAgoraRTCClient => {
  if (!client) {
    client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8',
    });
  }
  return client;
};

/**
 * Check if Agora is configured
 */
export const isAgoraConfigured = (): boolean => {
  return !!APP_ID;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get call token from backend
 */
export const getCallToken = async (
  orderId: string,
  callType: CallType
): Promise<CallSession> => {
  const response = await api.post('/calls/token', { orderId, callType });
  return response.data.data;
};

/**
 * Refresh token before expiration
 */
export const refreshToken = async (channelName: string): Promise<string> => {
  const response = await api.post('/calls/refresh-token', { channelName });
  return response.data.data.token;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface CallEventHandlers {
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void;
  onUserLeft?: (user: IAgoraRTCRemoteUser, reason: string) => void;
  onUserPublished?: (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => void;
  onUserUnpublished?: (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => void;
  onTokenWillExpire?: () => void;
  onTokenDidExpire?: () => void;
  onNetworkQuality?: (stats: { uplinkNetworkQuality: number; downlinkNetworkQuality: number }) => void;
  onConnectionStateChange?: (state: string, prevState: string, reason?: string) => void;
}

/**
 * Initialize call with event handlers
 */
export const initializeCall = (handlers: CallEventHandlers): IAgoraRTCClient => {
  const rtcClient = getClient();
  
  // User events
  if (handlers.onUserJoined) {
    rtcClient.on('user-joined', handlers.onUserJoined);
  }
  
  if (handlers.onUserLeft) {
    rtcClient.on('user-left', handlers.onUserLeft);
  }
  
  if (handlers.onUserPublished) {
    rtcClient.on('user-published', async (user, mediaType) => {
      if (mediaType === 'audio' || mediaType === 'video') {
        await rtcClient.subscribe(user, mediaType);
        handlers.onUserPublished?.(user, mediaType);
      }
    });
  }
  
  if (handlers.onUserUnpublished) {
    rtcClient.on('user-unpublished', handlers.onUserUnpublished);
  }
  
  // Token events
  if (handlers.onTokenWillExpire) {
    rtcClient.on('token-privilege-will-expire', handlers.onTokenWillExpire);
  }
  
  if (handlers.onTokenDidExpire) {
    rtcClient.on('token-privilege-did-expire', handlers.onTokenDidExpire);
  }
  
  // Network quality
  if (handlers.onNetworkQuality) {
    rtcClient.on('network-quality', handlers.onNetworkQuality);
  }
  
  // Connection state
  if (handlers.onConnectionStateChange) {
    rtcClient.on('connection-state-change', handlers.onConnectionStateChange);
  }
  
  return rtcClient;
};

/**
 * Join a call channel
 */
export const joinCall = async (
  session: CallSession,
  callType: CallType
): Promise<{ localAudio: IMicrophoneAudioTrack | null; localVideo: ICameraVideoTrack | null }> => {
  const rtcClient = getClient();
  
  // Join the channel
  await rtcClient.join(session.appId, session.channelName, session.token, session.uid);
  
  // Create local tracks based on call type
  if (callType === 'video') {
    [localAudioTrack, localVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    await rtcClient.publish([localAudioTrack, localVideoTrack]);
  } else {
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    await rtcClient.publish(localAudioTrack);
  }
  
  return {
    localAudio: localAudioTrack,
    localVideo: localVideoTrack,
  };
};

/**
 * Leave the current call
 */
export const leaveCall = async (): Promise<void> => {
  const rtcClient = getClient();
  
  // Close local tracks
  if (localAudioTrack) {
    localAudioTrack.close();
    localAudioTrack = null;
  }
  
  if (localVideoTrack) {
    localVideoTrack.close();
    localVideoTrack = null;
  }
  
  // Leave the channel
  await rtcClient.leave();
};

/**
 * End call and notify backend
 */
export const endCall = async (orderId: string, duration: number): Promise<void> => {
  await leaveCall();
  await api.post('/calls/end', { orderId, duration });
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Toggle microphone
 */
export const toggleMicrophone = async (enabled: boolean): Promise<boolean> => {
  if (localAudioTrack) {
    await localAudioTrack.setEnabled(enabled);
    return enabled;
  }
  return false;
};

/**
 * Get microphone status
 */
export const isMicrophoneEnabled = (): boolean => {
  return localAudioTrack?.enabled ?? false;
};

/**
 * Set microphone volume
 */
export const setMicrophoneVolume = (volume: number): void => {
  if (localAudioTrack) {
    localAudioTrack.setVolume(volume);
  }
};

/**
 * Get available microphones
 */
export const getMicrophones = async (): Promise<MediaDeviceInfo[]> => {
  return AgoraRTC.getMicrophones();
};

/**
 * Switch microphone device
 */
export const switchMicrophone = async (deviceId: string): Promise<void> => {
  if (localAudioTrack) {
    await localAudioTrack.setDevice(deviceId);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Toggle camera
 */
export const toggleCamera = async (enabled: boolean): Promise<boolean> => {
  if (localVideoTrack) {
    await localVideoTrack.setEnabled(enabled);
    return enabled;
  }
  return false;
};

/**
 * Get camera status
 */
export const isCameraEnabled = (): boolean => {
  return localVideoTrack?.enabled ?? false;
};

/**
 * Get available cameras
 */
export const getCameras = async (): Promise<MediaDeviceInfo[]> => {
  return AgoraRTC.getCameras();
};

/**
 * Switch camera device
 */
export const switchCamera = async (deviceId: string): Promise<void> => {
  if (localVideoTrack) {
    await localVideoTrack.setDevice(deviceId);
  }
};

/**
 * Play local video in element
 */
export const playLocalVideo = (element: HTMLElement): void => {
  if (localVideoTrack) {
    localVideoTrack.play(element);
  }
};

/**
 * Play remote video in element
 */
export const playRemoteVideo = (user: IAgoraRTCRemoteUser, element: HTMLElement): void => {
  const videoTrack = user.videoTrack;
  if (videoTrack) {
    videoTrack.play(element);
  }
};

/**
 * Play remote audio
 */
export const playRemoteAudio = (user: IAgoraRTCRemoteUser): void => {
  const audioTrack = user.audioTrack;
  if (audioTrack) {
    audioTrack.play();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN SHARING
// ═══════════════════════════════════════════════════════════════════════════════

let screenTrack: ILocalVideoTrack | null = null;

/**
 * Start screen sharing
 */
export const startScreenShare = async (): Promise<ILocalVideoTrack> => {
  const rtcClient = getClient();
  
  screenTrack = await AgoraRTC.createScreenVideoTrack({
    encoderConfig: '1080p_1',
  }, 'disable');
  
  // Unpublish camera track if exists
  if (localVideoTrack) {
    await rtcClient.unpublish(localVideoTrack);
  }
  
  // Publish screen track
  await rtcClient.publish(screenTrack);
  
  // Handle user stopping screen share from browser UI
  screenTrack.on('track-ended', () => {
    stopScreenShare();
  });
  
  return screenTrack;
};

/**
 * Stop screen sharing
 */
export const stopScreenShare = async (): Promise<void> => {
  const rtcClient = getClient();
  
  if (screenTrack) {
    await rtcClient.unpublish(screenTrack);
    screenTrack.close();
    screenTrack = null;
    
    // Re-publish camera track if exists
    if (localVideoTrack) {
      await rtcClient.publish(localVideoTrack);
    }
  }
};

/**
 * Check if screen sharing
 */
export const isScreenSharing = (): boolean => {
  return screenTrack !== null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALL QUALITY
// ═══════════════════════════════════════════════════════════════════════════════

export interface CallQuality {
  uplinkNetworkQuality: number;
  downlinkNetworkQuality: number;
  rtt: number; // Round trip time in ms
  packetLossRate: number;
}

/**
 * Get call quality metrics
 */
export const getCallQuality = (): CallQuality | null => {
  const rtcClient = getClient();
  const stats = rtcClient.getRTCStats();
  
  if (!stats) return null;
  
  return {
    uplinkNetworkQuality: 0, // Set by network-quality event
    downlinkNetworkQuality: 0,
    rtt: stats.RTT ?? 0,
    packetLossRate: 0,
  };
};

/**
 * Interpret network quality number
 */
export const getNetworkQualityLabel = (quality: number): string => {
  switch (quality) {
    case 0:
      return 'unknown';
    case 1:
      return 'excellent';
    case 2:
      return 'good';
    case 3:
      return 'poor';
    case 4:
      return 'bad';
    case 5:
      return 'very bad';
    case 6:
      return 'disconnected';
    default:
      return 'unknown';
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check device permissions
 */
export const checkPermissions = async (): Promise<{
  microphone: boolean;
  camera: boolean;
}> => {
  const result = { microphone: false, camera: false };
  
  try {
    const micPermission = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    result.microphone = micPermission.state === 'granted';
  } catch {
    // Permission API not supported, try direct access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      result.microphone = true;
    } catch {
      result.microphone = false;
    }
  }
  
  try {
    const camPermission = await navigator.permissions.query({
      name: 'camera' as PermissionName,
    });
    result.camera = camPermission.state === 'granted';
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      result.camera = true;
    } catch {
      result.camera = false;
    }
  }
  
  return result;
};

/**
 * Request device permissions
 */
export const requestPermissions = async (
  audio: boolean = true,
  video: boolean = false
): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALL NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initiate call to pharmacist
 */
export const initiateCall = async (
  orderId: string,
  callType: CallType
): Promise<{ channelName: string }> => {
  const response = await api.post('/calls/initiate', { orderId, callType });
  return response.data.data;
};

/**
 * Accept incoming call
 */
export const acceptCall = async (channelName: string): Promise<CallSession> => {
  const response = await api.post('/calls/accept', { channelName });
  return response.data.data;
};

/**
 * Decline incoming call
 */
export const declineCall = async (channelName: string, reason?: string): Promise<void> => {
  await api.post('/calls/decline', { channelName, reason });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up all resources
 */
export const cleanup = async (): Promise<void> => {
  await leaveCall();
  
  if (screenTrack) {
    screenTrack.close();
    screenTrack = null;
  }
  
  client?.removeAllListeners();
  client = null;
};

export default {
  isAgoraConfigured,
  getCallToken,
  refreshToken,
  initializeCall,
  joinCall,
  leaveCall,
  endCall,
  toggleMicrophone,
  isMicrophoneEnabled,
  setMicrophoneVolume,
  getMicrophones,
  switchMicrophone,
  toggleCamera,
  isCameraEnabled,
  getCameras,
  switchCamera,
  playLocalVideo,
  playRemoteVideo,
  playRemoteAudio,
  startScreenShare,
  stopScreenShare,
  isScreenSharing,
  getCallQuality,
  getNetworkQualityLabel,
  checkPermissions,
  requestPermissions,
  initiateCall,
  acceptCall,
  declineCall,
  cleanup,
};
