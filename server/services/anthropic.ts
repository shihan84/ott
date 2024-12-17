import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class AnthropicService {
  async analyzeFlussonicError(error: string, context: {
    serverUrl?: string;
    lastSuccessful?: string;
    attempts?: number;
  }): Promise<string> {
    try {
      const systemPrompt = `You are a helpful AI assistant specializing in diagnosing Flussonic Media Server connectivity issues. 
      Analyze the provided error message and context to give a clear, concise explanation of the problem and a specific recommendation 
      to fix it. Focus on common issues like authentication, network connectivity, SSL certificates, and API compatibility.`;

      const contextStr = `
Server URL: ${context.serverUrl || 'Not provided'}
Last successful connection: ${context.lastSuccessful || 'Never'}
Failed attempts: ${context.attempts || 1}
Error message: ${error}`;

      const message = await anthropic.messages.create({
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Based on this Flussonic Media Server error context, what's the likely issue and how can it be fixed?\n\n${contextStr}`
        }],
        model: 'claude-3-5-sonnet-20241022',
      });

      return message.content[0].text;
    } catch (error) {
      console.error('Error analyzing Flussonic error:', error);
      return 'Unable to analyze error at this time. Please check the server logs for more information.';
    }
  }
}

export const anthropicService = new AnthropicService();
