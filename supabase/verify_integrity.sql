SELECT user_id, check_balance_integrity(user_id) 
FROM wallets LIMIT 5;
