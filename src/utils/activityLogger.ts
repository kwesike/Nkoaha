import { supabase } from "../lib/supabase";

export async function logActivity(
  userId: string,
  action: string,
  documentId?: string,
  metadata?: any
) {
  await supabase.from("activity_logs").insert({
    user_id: userId,
    action,
    document_id: documentId,
    metadata,
  });
}
