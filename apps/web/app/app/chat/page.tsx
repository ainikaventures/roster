import { requireScope } from '@/lib/scope';
import { ChatApp } from '@/components/chat/chat-app';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chat' };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { channel?: string };
}) {
  const ctx = await requireScope();
  return <ChatApp userId={ctx.userId} initialChannelId={searchParams.channel ?? null} />;
}
