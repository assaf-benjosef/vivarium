/**
 * ChatProvider interface — abstracts the messaging platform.
 * Currently only Telegram, but designed for future expansion.
 */
export interface ChatProvider {
  /** Start listening for messages */
  start(): Promise<void>;

  /** Stop listening */
  stop(): Promise<void>;

  /** Send a text message to a specific chat */
  sendMessage(chatId: number | string, text: string): Promise<void>;

  /** Send an image to a specific chat */
  sendImage(chatId: number | string, image: Buffer, caption?: string): Promise<void>;
}
