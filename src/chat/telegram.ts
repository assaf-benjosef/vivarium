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
      const text = ctx.message.text.trim();

      // Handle slash commands
      if (text.startsWith("/")) {
        if (text === "/new" || text === "/clear") {
          this.runner.clearSession();
          await ctx.reply("🧹 My memory has been wiped. We are starting fresh!");
          return;
        }
        
        if (text === "/status") {
          const status = this.runner.getStatus();
          const cost = status.totalCostUsd.toFixed(3);
          const memory = status.sessionId ? "Active" : "Fresh";
          await ctx.reply(`🟢 Terry is online.\n\nMemory: ${memory}\nTotal cost this session: $${cost}`);
          return;
        }

        if (text === "/help" || text === "/start") {
          await ctx.reply(
            "👋 Hi! I'm Terry, your AI app developer.\n\n" +
            "Tell me what you want to build, and I'll write the code, run it, and show you screenshots.\n\n" +
            "Commands:\n" +
            "• /new - Start a fresh conversation (wipe memory)\n" +
            "• /status - Check my status and session cost\n" +
            "• /help - Show this message"
          );
          return;
        }
      }

      // Keep "typing..." visible for the entire agent run (Telegram expires it after ~5s)
      const typingInterval = setInterval(async () => {
        try {
          await ctx.api.sendChatAction(chatId, "typing");
        } catch {
          // Ignore — best effort
        }
      }, 4000);

      // Send initial typing indicator
      await ctx.api.sendChatAction(chatId, "typing");

      try {
        const response = await this.runner.run(text, chatId, async (event) => {
          if (event.type === "text") {
            const chunks = this.splitMessage(event.text);
            for (const chunk of chunks) {
              await ctx.reply(chunk).catch(() => {});
            }
          } else if (event.type === "screenshot") {
            await ctx.replyWithPhoto(new InputFile(event.buffer)).catch(() => {});
          }
        });

        clearInterval(typingInterval);

      } catch (err) {
        clearInterval(typingInterval);
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
