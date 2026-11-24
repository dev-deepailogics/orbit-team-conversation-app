"use client";

import React, { useEffect } from "react";
import { MailFoldersSidebar } from "./MailFoldersSidebar";
import { MailMessageList } from "./MailMessageList";
import { MailMessageDetail } from "./MailMessageDetail";
import { MailComposeModal } from "./MailComposeModal";
import { AddMailAccountModal } from "./AddMailAccountModal";
import { useMailStore } from "@/stores/mailStore";
import { getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@orbit/types";

export const WebmailView: React.FC = () => {
  const { fetchAccounts, fetchMessages, accounts, openAddAccount } = useMailStore();

  useEffect(() => {
    fetchAccounts().then(() => {
      fetchMessages(1);
    });

    // Real-time socket updates for new mail and sync progress
    try {
      const socket = getSocket();
      const onMailNew = () => {
        fetchMessages();
      };
      const onMailStatus = () => {
        fetchAccounts();
      };

      socket.on(SOCKET_EVENTS.MAIL_NEW, onMailNew);
      socket.on(SOCKET_EVENTS.MAIL_SYNC_STATUS, onMailStatus);

      return () => {
        socket.off(SOCKET_EVENTS.MAIL_NEW, onMailNew);
        socket.off(SOCKET_EVENTS.MAIL_SYNC_STATUS, onMailStatus);
      };
    } catch {
      // Socket not ready
    }
  }, [fetchAccounts, fetchMessages]);

  return (
    <div
      className="flex-1 flex h-full overflow-hidden w-full relative"
      style={{ backgroundColor: "var(--theme-bg-app)" }}
    >
      {/* 1. Folders & Accounts Sidebar */}
      <MailFoldersSidebar />

      {/* 2. Message List Pane */}
      <MailMessageList />

      {/* 3. Message Viewer / Reading Pane */}
      <MailMessageDetail />

      {/* Compose & Add Account Modals */}
      <MailComposeModal />
      <AddMailAccountModal />
    </div>
  );
};
