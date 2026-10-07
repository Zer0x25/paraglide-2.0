"use client";

import { Modal, Spinner } from './ui';
import { useSyncCalendar } from './calendar-sync/useSyncCalendar';
import { SyncTargetSelector } from './calendar-sync/SyncTargetSelector';
import { SyncPlatformOptions } from './calendar-sync/SyncPlatformOptions';
import { SyncDirectLinkSection } from './calendar-sync/SyncDirectLinkSection';

export interface SyncCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncCalendarModal({ isOpen, onClose }: SyncCalendarModalProps) {
  const sync = useSyncCalendar(isOpen);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Sincronización de Calendario"
      size="xl"
    >
      {sync.loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="md" color="border-blue-500" className="mb-3" />
          <p className="text-sm font-medium">Generando enlaces y tokens seguros...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <SyncTargetSelector
            syncInfo={sync.syncInfo}
            selectedTarget={sync.selectedTarget}
            onSelectTarget={sync.setSelectedTarget}
          />

          <SyncPlatformOptions
            finalWebcalUrl={sync.finalWebcalUrl}
            isOneClickGoogle={sync.isOneClickGoogle}
            isReconciling={sync.isReconciling}
            googleCalendarEnabled={sync.syncInfo?.googleCalendar?.enabled}
            onGoogleCalendarFlow={sync.handleGoogleCalendarFlow}
            onReconcileGoogleCalendar={sync.handleReconcileGoogleCalendar}
            onDownloadIcs={sync.handleDownloadIcs}
          />

          <SyncDirectLinkSection
            finalHttpUrl={sync.finalHttpUrl}
            copied={sync.copied}
            currentTargetName={sync.currentTargetName}
            expiraEn={sync.activeExpiraEn}
            isRegenerating={sync.isRegenerating}
            onCopyUrl={sync.handleCopyUrl}
            onRegenerate={sync.handleRegenerateToken}
          />
        </div>
      )}
    </Modal>
  );
}
