create table public.chats (  
  id uuid not null default gen_random_uuid (),  
  user_id uuid not null,  
  message text not null,  
  sender_type text not null check (sender_type in ('user', 'admin')),  
  is_read boolean default false,  
  created_at timestamp with time zone default now(),  
  constraint chats_pkey primary key (id),  
  constraint chats_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete cascade  
);  
create index idx_chats_user_id on public.chats(user_id);  
create index idx_chats_created_at on public.chats(created_at); 
