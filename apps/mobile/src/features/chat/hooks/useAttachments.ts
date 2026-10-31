import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';
import { launchImageLibrary, type ImageLibraryOptions } from 'react-native-image-picker';
import { useSettingsStore } from '@/features/settings/store';
import { getErrorMessage } from '@/lib/api';
import { uploadFile, type LocalFile, type StagedAttachment } from '../services/chatApi';

export interface PendingFile extends LocalFile {
  key: string;
  // Set when the upload finishes; the message can't be sent until every file has it.
  staged?: StagedAttachment;
}

// The server's @fastify/multipart limit (apps/server/src/index.ts).
const MAX_BYTES = 50 * 1024 * 1024;

// The picker re-encodes photos on the way out (JPEG, long edge ≤ 1920px), so compression costs no extra library.
// Same limits as web's compressImage.
// ponytail: library videos are copied untouched on both platforms (videoQuality only affects the camera).
// Add react-native-compressor to shrink videos.
const COMPRESSED: Partial<ImageLibraryOptions> = { quality: 0.8, maxWidth: 1920, maxHeight: 1920 };

type Picked = LocalFile & { size?: number | null };

// Files upload as soon as they're picked (like web), so Send is instant once they're done.
export function useAttachments(channelId: string) {
  const compress = useSettingsStore(s => s.compressUploads);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const nextKey = useRef(0);

  const add = (picked: Picked[]) => {
    const tooBig = picked.filter(f => (f.size ?? 0) > MAX_BYTES);
    if (tooBig.length) {
      Alert.alert('File too large', `${tooBig.map(f => f.name).join(', ')} is over the 50 MB limit.`);
    }
    for (const { uri, name, type, size } of picked) {
      if ((size ?? 0) > MAX_BYTES) continue;
      const key = String(nextKey.current++);
      const file = { uri, name, type };
      setFiles(prev => [...prev, { ...file, key }]);
      uploadFile(channelId, file).then(
        staged => setFiles(prev => prev.map(f => (f.key === key ? { ...f, staged } : f))),
        err => {
          setFiles(prev => prev.filter(f => f.key !== key));
          Alert.alert('Upload failed', `${name}: ${getErrorMessage(err, 'Please try again.')}`);
        },
      );
    }
  };

  const pickMedia = async () => {
    const res = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10, ...(compress ? COMPRESSED : {}) });
    if (res.errorCode) {
      Alert.alert('Could not open photos', res.errorMessage || 'Please try again.');
      return;
    }
    add(
      (res.assets ?? []).flatMap(a =>
        a.uri ? [{ uri: a.uri, name: a.fileName || 'photo', type: a.type || 'application/octet-stream', size: a.fileSize }] : [],
      ),
    );
  };

  const pickFiles = async () => {
    try {
      const picked = await pick({ allowMultiSelection: true });
      add(picked.map(f => ({ uri: f.uri, name: f.name || 'file', type: f.type || 'application/octet-stream', size: f.size })));
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not open files', 'Please try again.');
    }
  };

  return {
    files,
    staged: files.flatMap(f => (f.staged ? [f.staged] : [])),
    isUploading: files.some(f => !f.staged),
    pickMedia,
    pickFiles,
    remove: (key: string) => setFiles(prev => prev.filter(f => f.key !== key)),
    clear: () => setFiles([]),
  };
}
