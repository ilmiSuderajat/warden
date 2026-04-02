SELECT id FROM public.users LIMIT 1;SELECT action, target_id, payload FROM audit_log WHERE action = 'pending_refund_warning';
SELECT get_admin_stats();
