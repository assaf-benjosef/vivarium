import { Bot, InputFile } from "grammy";
import type { ChatProvider } from "./provider.js";
import type { AgentRunner } from "../agent/runner.js";
import type { Config } from "../config.js";

export class TelegramChat implements ChatProvider {
  private bot: Bot;
  private runner: AgentRunner;
  private allowedUsers: Set<number>;

  constructor(config: Config, runner: AgentRunner) {
    this.bot = new Bot(config.telegramBotToken);
    this.runner = runner;
    this.allowedUsers = new Set(config.allowedUsers);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Auth middleware
    this.bot.use(async (ctx, next) => {
      if (this.allowedUsers.size > 0 && ctx.from) {
        if (!this.allowedUsers.has(ctx.from.id)) {
          await ctx.reply("🔒 Sorry, I'm not set up to talk to you yet.");
          return;
        }
      }
      await next();
    });

    // Handle text messages
    this.bot.on("message:text", async (ctx) => {
      const chatId = ctx.chat.id;
      const text = ctx.message.text;

      // Show typing indicator
      await ctx.api.sendChatAction(chatId, "typing");

      try {
        const response = await this.runner.run(text, chatId);

        // Send text response (split if too long for Telegram)
        if (response.text) {
          const chunks = this.splitMessage(response.text);
          for (const chunk of chunks) {
            await ctx.reply(chunk);
          }
        }

        // Send screenshot if available
        if (response.screenshot) {
          await this.sendImage(chatId, response.screenshot, "📸 Here's how it looks");
        }
      } catch (err) {
        console.error("[telegram] Error handling message:", err);
        await ctx.reply("Something went wrong on my end. Let me try again in a moment.");
      }
    });

    // Handle photos (user sending images)
    this.bot.on("message:photo", async (ctx) => {
      await ctx.reply(
        "I can see you sent an image! For now, I work best with text descriptions. " +
        "Tell me what you'd like and I'll make it happen."
      );
    });
  }

  async start(): Promise<void> {
    await this.bot.start({
      onStart: () => {
        console.log("[telegram] Bot is running");
      },
    });
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      await this.bot.api.sendMessage(Number(chatId), chunk);
    }
  }

  async sendImage(chatId: number | string, image: Buffer, caption?: string): Promise<void> {
    await this.bot.api.sendPhoto(Number(chatId), new InputFile(image), {
      caption,
    });
  }

  /** Split long messages to stay within Telegram's 4096 char limit */
  private splitMessage(text: string, maxLen = 4000): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a newline
      let splitAt = remaining.lastIndexOf("\n", maxLen);
      if (splitAt < maxLen * 0.5) {
        // No good newline, split at space
        splitAt = remaining.lastIndexOf(" ", maxLen);
      }
      if (splitAt < maxLen * 0.5) {
        // No good split point, hard cut
        splitAt = maxLen;
      }

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
  }
}
