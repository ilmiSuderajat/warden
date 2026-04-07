import { createAdminClient } from "./serverAuth"

export type NotificationType = 'order' | 'promo' | 'live' | 'finance' | 'system'

interface CreateNotificationParams {
    userId: string
    type: NotificationType
    title: string
    message: string
    link?: string
    forShop?: boolean
}

/**
 * Creates a notification for a user.
 * Bypasses RLS using the admin client.
 */
export async function createNotification({
    userId,
    type,
    title,
    message,
    link,
    forShop = false
}: CreateNotificationParams) {
    const supabase = createAdminClient()
    
    const { error } = await supabase
        .from("notifications")
        .insert({
            user_id: userId,
            type,
            title,
            message,
            link,
            for_shop: forShop,
            is_read: false
        })

    if (error) {
        console.error("[createNotification] Error inserting notification:", error)
        return { success: false, error }
    }

    return { success: true }
}
