import { SUI_CONFIG } from "@/config/sui";
import { MOCK_RATE_MYR_PER_SUI } from "@/services/mocks/data";
import type { ConversionQuote } from "@/types/domain";

export const quoteService = {
  async getQuote(tokenType = SUI_CONFIG.defaultToken): Promise<ConversionQuote> {
    await new Promise((r) => setTimeout(r, 300));
    const now = Date.now();
    return {
      rateMyrPerToken: MOCK_RATE_MYR_PER_SUI,
      tokenType,
      quotedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
    };
  },
  toToken(amountMyr: number, quote: ConversionQuote) {
    return amountMyr / quote.rateMyrPerToken;
  },
  toMyr(tokenAmount: number, quote: ConversionQuote) {
    return tokenAmount * quote.rateMyrPerToken;
  },
};
