// Any message view can turn a message into a personal to-do by calling addTodoFromMessage. QuickTodos (always mounted
// in the app page) listens for the event and saves it, so no handlers are threaded through the views.

export const ADD_TODO_EVENT = 'orbit:add-todo';
const MAX_TEXT = 500;

export interface NewTodo {
  text: string;
  /** message://<channelId>/<messageId>[/<parentMessageId>], to jump back to the message. */
  messageLink?: string;
}

export function addTodoFromMessage(msg: {
  id: string;
  channelId: string;
  parentMessageId?: string | null;
  content?: string | null;
}) {
  const plain = (msg.content || '').replace(/\s+/g, ' ').trim();
  const text = plain ? (plain.length > MAX_TEXT ? `${plain.slice(0, MAX_TEXT - 1)}…` : plain) : 'Follow up on message';
  const messageLink = `message://${msg.channelId}/${msg.id}${msg.parentMessageId ? `/${msg.parentMessageId}` : ''}`;
  window.dispatchEvent(new CustomEvent<NewTodo>(ADD_TODO_EVENT, { detail: { text, messageLink } }));
}
