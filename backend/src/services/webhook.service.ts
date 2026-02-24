import axios from "axios";
import CryptoJS from "crypto-js";

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  events: string[];
}

// In-memory storage for demonstration (in a real app, this would be a database)
const subscriptions: WebhookSubscription[] = [];

export class WebhookService {
  static async subscribe(url: string, secret: string, events: string[]) {
    const subscription: WebhookSubscription = {
      id: Math.random().toString(36).substring(2, 11),
      url,
      secret,
      events,
    };
    subscriptions.push(subscription);
    return subscription;
  }

  static listSubscriptions() {
    return subscriptions;
  }

  static deleteSubscription(id: string) {
    const index = subscriptions.findIndex((s) => s.id === id);
    if (index !== -1) {
      subscriptions.splice(index, 1);
      return true;
    }
    return false;
  }

  static async dispatch(eventType: string, payload: any) {
    const relevantSubscriptions = subscriptions.filter((s) =>
      s.events.includes(eventType) || s.events.includes("*")
    );

    const dispatchPromises = relevantSubscriptions.map(async (sub) => {
      const timestamp = Date.now().toString();
      const payloadString = JSON.stringify(payload);
      const signature = this.generateSignature(payloadString, sub.secret, timestamp);

      try {
        await this.sendWithRetry(sub.url, payload, {
          "X-PayD-Event": eventType,
          "X-PayD-Signature": signature,
          "X-PayD-Timestamp": timestamp,
        });
        console.log(`Webhook dispatched successfully to ${sub.url}`);
      } catch (error) {
        console.error(`Failed to dispatch webhook to ${sub.url}:`, error);
      }
    });

    await Promise.allSettled(dispatchPromises);
  }

  private static generateSignature(payload: string, secret: string, timestamp: string) {
    const message = `${timestamp}.${payload}`;
    return CryptoJS.HmacSHA256(message, secret).toString(CryptoJS.enc.Hex);
  }

  private static async sendWithRetry(url: string, data: any, headers: any, retries = 3, delay = 1000) {
    try {
      await axios.post(url, data, { headers, timeout: 5000 });
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying webhook to ${url} (${retries} attempts left)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(url, data, headers, retries - 1, delay * 2);
      }
      throw error;
    }
  }
}
