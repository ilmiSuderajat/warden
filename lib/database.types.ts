export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          role: string | null
          is_blocked: boolean | null
          gender: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: string | null
          is_blocked?: boolean | null
          gender?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: string | null
          is_blocked?: boolean | null
          gender?: string | null
          created_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          user_id: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string | null
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_name: string
          whatsapp_number: string
          address: string
          total_amount: number
          status: string | null
          created_at: string | null
          user_id: string | null
          subtotal_amount: number | null
          shipping_amount: number | null
          distance_km: number | null
          phone_number: string | null
          shipping_address: string | null
          maps_link: string | null
          latitude: number | null
          longitude: number | null
          payment_method: string | null
          payment_status: string | null
        }
        Insert: {
          id?: string
          customer_name: string
          whatsapp_number: string
          address: string
          total_amount: number
          status?: string | null
          created_at?: string | null
          user_id?: string | null
          subtotal_amount?: number | null
          shipping_amount?: number | null
          distance_km?: number | null
          phone_number?: string | null
          shipping_address?: string | null
          maps_link?: string | null
          latitude?: number | null
          longitude?: number | null
          payment_method?: string | null
          payment_status?: string | null
        }
        Update: {
          id?: string
          customer_name?: string
          whatsapp_number?: string
          address?: string
          total_amount?: number
          status?: string | null
          created_at?: string | null
          user_id?: string | null
          subtotal_amount?: number | null
          shipping_amount?: number | null
          distance_km?: number | null
          phone_number?: string | null
          shipping_address?: string | null
          maps_link?: string | null
          latitude?: number | null
          longitude?: number | null
          payment_method?: string | null
          payment_status?: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_name: string | null
          quantity: number | null
          price: number | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          product_name?: string | null
          quantity?: number | null
          price?: number | null
        }
        Update: {
          id?: string
          order_id?: string | null
          product_name?: string | null
          quantity?: number | null
          price?: number | null
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          stock: number
          image_url: string | null
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          stock: number
          image_url?: string | null
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          stock?: number
          image_url?: string | null
          category?: string | null
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          image_url: string | null
        }
        Insert: {
          id?: string
          name: string
          image_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          image_url?: string | null
        }
      }
      addresses: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string | null
          detail: string | null
          is_default: boolean | null
          latitude: number | null
          longitude: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          phone?: string | null
          detail?: string | null
          is_default?: boolean | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          phone?: string | null
          detail?: string | null
          is_default?: boolean | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          user_id: string | null
          message: string
          sender_type: string
          created_at: string
          is_read: boolean | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          message: string
          sender_type: string
          created_at?: string
          is_read?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string | null
          message?: string
          sender_type?: string
          created_at?: string
          is_read?: boolean | null
        }
      }
      cart: {
        Row: {
          id: string
          user_id: string | null
          product_id: string | null
          quantity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          quantity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          quantity?: number | null
          created_at?: string
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string | null
          product_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          created_at?: string
        }
      }
      banners: {
          Row: {
              id: string
              image_url: string
              link_url: string | null
              created_at: string
          }
          Insert: {
              id?: string
              image_url: string
              link_url?: string | null
              created_at?: string
          }
          Update: {
              id?: string
              image_url?: string
              link_url?: string | null
              created_at?: string
          }
      }
      flash_sale_banners: {
          Row: {
              id: string
              image_url: string
              title: string | null
              end_time: string | null
              created_at: string
          }
          Insert: {
              id?: string
              image_url: string
              title?: string | null
              end_time?: string | null
              created_at?: string
          }
          Update: {
              id?: string
              image_url?: string
              title?: string | null
              end_time?: string | null
              created_at?: string
          }
      }
      vouchers: {
          Row: {
              id: string
              code: string
              discount_type: string
              discount_value: number
              min_order_amount: number | null
              max_discount_amount: number | null
              start_date: string | null
              end_date: string | null
              usage_limit: number | null
              used_count: number | null
              is_active: boolean | null
              created_at: string | null
          }
          Insert: {
              id?: string
              code: string
              discount_type: string
              discount_value: number
              min_order_amount?: number | null
              max_discount_amount?: number | null
              start_date?: string | null
              end_date?: string | null
              usage_limit?: number | null
              used_count?: number | null
              is_active?: boolean | null
              created_at?: string | null
          }
          Update: {
              id?: string
              code?: string
              discount_type?: string
              discount_value?: number
              min_order_amount?: number | null
              max_discount_amount?: number | null
              start_date?: string | null
              end_date?: string | null
              usage_limit?: number | null
              used_count?: number | null
              is_active?: boolean | null
              created_at?: string | null
          }
      }
    }
  }
}
