export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_collaboration_requests: {
        Row: {
          agent_user_id: string
          created_at: string
          id: string
          initiated_by: string
          player_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_user_id: string
          created_at?: string
          id?: string
          initiated_by?: string
          player_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_user_id?: string
          created_at?: string
          id?: string
          initiated_by?: string
          player_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_manual_players: {
        Row: {
          agent_user_id: string
          birth_year: number | null
          created_at: string
          current_team: string | null
          first_name: string
          id: string
          last_name: string
          photo_url: string | null
          position: string | null
          sport: string | null
        }
        Insert: {
          agent_user_id: string
          birth_year?: number | null
          created_at?: string
          current_team?: string | null
          first_name?: string
          id?: string
          last_name?: string
          photo_url?: string | null
          position?: string | null
          sport?: string | null
        }
        Update: {
          agent_user_id?: string
          birth_year?: number | null
          created_at?: string
          current_team?: string | null
          first_name?: string
          id?: string
          last_name?: string
          photo_url?: string | null
          position?: string | null
          sport?: string | null
        }
        Relationships: []
      }
      app_sessions: {
        Row: {
          created_at: string
          date: string
          duration_seconds: number
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          duration_seconds?: number
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_seconds?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      athletic_test_registrations: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          notification_method: string
          phone: string
          scheduled_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          notification_method?: string
          phone: string
          scheduled_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          notification_method?: string
          phone?: string
          scheduled_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_commenters: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          requested_user_id: string
          requester_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          requested_user_id: string
          requester_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          requested_user_id?: string
          requester_user_id?: string
          status?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      external_recommendation_requests: {
        Row: {
          club: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          message: string | null
          relationship: string | null
          requester_name: string
          requester_user_id: string
          season_from: string | null
          season_to: string | null
          status: string
          target_email: string
          token: string
        }
        Insert: {
          club?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          relationship?: string | null
          requester_name: string
          requester_user_id: string
          season_from?: string | null
          season_to?: string | null
          status?: string
          target_email: string
          token?: string
        }
        Update: {
          club?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          relationship?: string | null
          requester_name?: string
          requester_user_id?: string
          season_from?: string | null
          season_to?: string | null
          status?: string
          target_email?: string
          token?: string
        }
        Relationships: []
      }
      external_recommendations: {
        Row: {
          author_email: string
          author_name: string
          content: string
          created_at: string | null
          id: string
          recipient_user_id: string
          request_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          author_email: string
          author_name: string
          content: string
          created_at?: string | null
          id?: string
          recipient_user_id: string
          request_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          author_email?: string
          author_name?: string
          content?: string
          created_at?: string | null
          id?: string
          recipient_user_id?: string
          request_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_recommendations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "external_recommendation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_players: {
        Row: {
          created_at: string
          id: string
          player_user_id: string
          scout_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_user_id: string
          scout_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_user_id?: string
          scout_user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      group_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_token: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_token?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_token?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          muted: boolean
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          muted?: boolean
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
          shared_post_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
          shared_post_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
          shared_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_shared_post_id_fkey"
            columns: ["shared_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_restricted_senders: {
        Row: {
          created_at: string
          group_id: string
          id: string
          restricted_user_id: string
          restrictor_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          restricted_user_id: string
          restrictor_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          restricted_user_id?: string
          restrictor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_restricted_senders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_test_unlocks: {
        Row: {
          created_at: string | null
          id: string
          test_key: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          test_key: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          test_key?: string
          user_id?: string
        }
        Relationships: []
      }
      invite_uses: {
        Row: {
          created_at: string | null
          id: string
          invitee_id: string
          inviter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitee_id: string
          inviter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invitee_id?: string
          inviter_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
          shared_post_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
          shared_post_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
          shared_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_shared_post_id_fkey"
            columns: ["shared_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      player_career_entries: {
        Row: {
          created_at: string
          currently_active: boolean
          description: string | null
          end_date: string | null
          id: string
          sort_order: number
          start_date: string | null
          team_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currently_active?: boolean
          description?: string | null
          end_date?: string | null
          id?: string
          sort_order?: number
          start_date?: string | null
          team_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currently_active?: boolean
          description?: string | null
          end_date?: string | null
          id?: string
          sort_order?: number
          start_date?: string | null
          team_name?: string
          user_id?: string
        }
        Relationships: []
      }
      player_profiles: {
        Row: {
          about_documents: string[] | null
          acceleration: number | null
          acceleration_video: string | null
          agent_email: string | null
          agent_name: string | null
          agent_phone: string | null
          assists: number | null
          between_legs_cross_video: string | null
          between_the_legs_video: string | null
          bio: string | null
          career_description: string | null
          control_pass_video: string | null
          coordination_video: string | null
          created_at: string
          crossover_video: string | null
          current_team: string | null
          cv_url: string | null
          date_of_birth: string | null
          defense: number | null
          double_cross_video: string | null
          endurance: number | null
          endurance_video: string | null
          father_height_cm: number | null
          first_name: string
          free_throw_shooting_video: string | null
          full_match_descriptions: string[] | null
          full_match_videos: string[] | null
          gender: string | null
          goals: number | null
          height_cm: number | null
          id: string
          instagram_url: string | null
          jumping: number | null
          jumping_video: string | null
          last_name: string
          long_pass_video: string | null
          matches_played: number | null
          mother_height_cm: number | null
          nationality: string | null
          palmares: string | null
          palmares_documents: string[] | null
          photo_url: string | null
          position: string | null
          precision_video: string | null
          preferred_foot: string | null
          slalom_video: string | null
          speed: number | null
          speed_video: string | null
          sport: string | null
          star_shooting_drill: number | null
          star_shooting_drill_video: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          video_descriptions: string[] | null
          video_highlights: string[] | null
          weight_kg: number | null
          wingspan_cm: number | null
        }
        Insert: {
          about_documents?: string[] | null
          acceleration?: number | null
          acceleration_video?: string | null
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          assists?: number | null
          between_legs_cross_video?: string | null
          between_the_legs_video?: string | null
          bio?: string | null
          career_description?: string | null
          control_pass_video?: string | null
          coordination_video?: string | null
          created_at?: string
          crossover_video?: string | null
          current_team?: string | null
          cv_url?: string | null
          date_of_birth?: string | null
          defense?: number | null
          double_cross_video?: string | null
          endurance?: number | null
          endurance_video?: string | null
          father_height_cm?: number | null
          first_name?: string
          free_throw_shooting_video?: string | null
          full_match_descriptions?: string[] | null
          full_match_videos?: string[] | null
          gender?: string | null
          goals?: number | null
          height_cm?: number | null
          id?: string
          instagram_url?: string | null
          jumping?: number | null
          jumping_video?: string | null
          last_name?: string
          long_pass_video?: string | null
          matches_played?: number | null
          mother_height_cm?: number | null
          nationality?: string | null
          palmares?: string | null
          palmares_documents?: string[] | null
          photo_url?: string | null
          position?: string | null
          precision_video?: string | null
          preferred_foot?: string | null
          slalom_video?: string | null
          speed?: number | null
          speed_video?: string | null
          sport?: string | null
          star_shooting_drill?: number | null
          star_shooting_drill_video?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          video_descriptions?: string[] | null
          video_highlights?: string[] | null
          weight_kg?: number | null
          wingspan_cm?: number | null
        }
        Update: {
          about_documents?: string[] | null
          acceleration?: number | null
          acceleration_video?: string | null
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          assists?: number | null
          between_legs_cross_video?: string | null
          between_the_legs_video?: string | null
          bio?: string | null
          career_description?: string | null
          control_pass_video?: string | null
          coordination_video?: string | null
          created_at?: string
          crossover_video?: string | null
          current_team?: string | null
          cv_url?: string | null
          date_of_birth?: string | null
          defense?: number | null
          double_cross_video?: string | null
          endurance?: number | null
          endurance_video?: string | null
          father_height_cm?: number | null
          first_name?: string
          free_throw_shooting_video?: string | null
          full_match_descriptions?: string[] | null
          full_match_videos?: string[] | null
          gender?: string | null
          goals?: number | null
          height_cm?: number | null
          id?: string
          instagram_url?: string | null
          jumping?: number | null
          jumping_video?: string | null
          last_name?: string
          long_pass_video?: string | null
          matches_played?: number | null
          mother_height_cm?: number | null
          nationality?: string | null
          palmares?: string | null
          palmares_documents?: string[] | null
          photo_url?: string | null
          position?: string | null
          precision_video?: string | null
          preferred_foot?: string | null
          slalom_video?: string | null
          speed?: number | null
          speed_video?: string | null
          sport?: string | null
          star_shooting_drill?: number | null
          star_shooting_drill_video?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          video_descriptions?: string[] | null
          video_highlights?: string[] | null
          weight_kg?: number | null
          wingspan_cm?: number | null
        }
        Relationships: []
      }
      player_test_unlocks: {
        Row: {
          best_login_streak: number
          best_streak: number
          created_at: string
          current_streak: number
          grace_days_used: number
          id: string
          last_visit_date: string | null
          login_streak: number
          next_test_preview: string | null
          next_unlock_started_on: string | null
          unlocked_tests: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          best_login_streak?: number
          best_streak?: number
          created_at?: string
          current_streak?: number
          grace_days_used?: number
          id?: string
          last_visit_date?: string | null
          login_streak?: number
          next_test_preview?: string | null
          next_unlock_started_on?: string | null
          unlocked_tests?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          best_login_streak?: number
          best_streak?: number
          created_at?: string
          current_streak?: number
          grace_days_used?: number
          id?: string
          last_visit_date?: string | null
          login_streak?: number
          next_test_preview?: string | null
          next_unlock_started_on?: string | null
          unlocked_tests?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_video_notifications: {
        Row: {
          created_at: string
          id: string
          player_id: string
          test_key: string | null
          type: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          test_key?: string | null
          type: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          test_key?: string | null
          type?: string
          video_url?: string | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          is_visible_on_profile: boolean
          post_id: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_visible_on_profile?: boolean
          post_id: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_visible_on_profile?: boolean
          post_id?: string
          tagged_by_user_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_disabled: boolean
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string | null
          is_archived: boolean
          post_type: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          comments_disabled?: boolean
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          post_type?: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          comments_disabled?: boolean
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          post_type?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      profile_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          profile_user_id: string
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          profile_user_id: string
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          profile_user_id?: string
          viewer_user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          author_user_id: string
          content: string
          created_at: string
          id: string
          initiated_by: string
          recipient_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          content?: string
          created_at?: string
          id?: string
          initiated_by?: string
          recipient_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          initiated_by?: string
          recipient_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations_settings: {
        Row: {
          enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restricted_accounts: {
        Row: {
          created_at: string
          id: string
          restricted_id: string
          restrictor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restricted_id: string
          restrictor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restricted_id?: string
          restrictor_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          collection_id: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_certifications: {
        Row: {
          created_at: string
          credential_url: string | null
          documents: string[] | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_url?: string | null
          documents?: string[] | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string
          name?: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credential_url?: string | null
          documents?: string[] | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      scout_education: {
        Row: {
          created_at: string
          degree: string
          description: string | null
          documents: string[] | null
          end_date: string | null
          field_of_study: string | null
          id: string
          institution: string
          sort_order: number
          start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string
          description?: string | null
          documents?: string[] | null
          end_date?: string | null
          field_of_study?: string | null
          id?: string
          institution?: string
          sort_order?: number
          start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string
          description?: string | null
          documents?: string[] | null
          end_date?: string | null
          field_of_study?: string | null
          id?: string
          institution?: string
          sort_order?: number
          start_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scout_player_notes: {
        Row: {
          created_at: string
          custom_labels: string[]
          custom_qualities: string[]
          id: string
          label: string | null
          match_date: string | null
          match_watched: string | null
          observations: string | null
          observed_qualities: string[]
          personal_rating: number
          player_user_id: string
          priority: string | null
          scout_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_labels?: string[]
          custom_qualities?: string[]
          id?: string
          label?: string | null
          match_date?: string | null
          match_watched?: string | null
          observations?: string | null
          observed_qualities?: string[]
          personal_rating?: number
          player_user_id: string
          priority?: string | null
          scout_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_labels?: string[]
          custom_qualities?: string[]
          id?: string
          label?: string | null
          match_date?: string | null
          match_watched?: string | null
          observations?: string | null
          observed_qualities?: string[]
          personal_rating?: number
          player_user_id?: string
          priority?: string | null
          scout_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scout_player_reports: {
        Row: {
          agent_name: string | null
          conclusion_text: string | null
          cons_list: string[] | null
          contract_until: string | null
          created_at: string | null
          current_club: string | null
          custom_sections: Json | null
          financial_notes: string | null
          fit_rating: number | null
          hidden_sections: string[] | null
          id: string
          league: string | null
          mental_notes: string | null
          mental_rating: number | null
          overall_rating: number | null
          physical_notes: string | null
          physical_rating: number | null
          player_user_id: string
          position: string | null
          pros_list: string[] | null
          recommendation: string | null
          salary_range: string | null
          scout_user_id: string
          technical_notes: string | null
          technical_rating: number | null
          transfer_value: string | null
          updated_at: string | null
        }
        Insert: {
          agent_name?: string | null
          conclusion_text?: string | null
          cons_list?: string[] | null
          contract_until?: string | null
          created_at?: string | null
          current_club?: string | null
          custom_sections?: Json | null
          financial_notes?: string | null
          fit_rating?: number | null
          hidden_sections?: string[] | null
          id?: string
          league?: string | null
          mental_notes?: string | null
          mental_rating?: number | null
          overall_rating?: number | null
          physical_notes?: string | null
          physical_rating?: number | null
          player_user_id: string
          position?: string | null
          pros_list?: string[] | null
          recommendation?: string | null
          salary_range?: string | null
          scout_user_id: string
          technical_notes?: string | null
          technical_rating?: number | null
          transfer_value?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_name?: string | null
          conclusion_text?: string | null
          cons_list?: string[] | null
          contract_until?: string | null
          created_at?: string | null
          current_club?: string | null
          custom_sections?: Json | null
          financial_notes?: string | null
          fit_rating?: number | null
          hidden_sections?: string[] | null
          id?: string
          league?: string | null
          mental_notes?: string | null
          mental_rating?: number | null
          overall_rating?: number | null
          physical_notes?: string | null
          physical_rating?: number | null
          player_user_id?: string
          position?: string | null
          pros_list?: string[] | null
          recommendation?: string | null
          salary_range?: string | null
          scout_user_id?: string
          technical_notes?: string | null
          technical_rating?: number | null
          transfer_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scout_posts: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scout_profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          cover_photo_url: string | null
          created_at: string
          first_name: string
          gender: string | null
          id: string
          languages: string[] | null
          last_name: string
          organization: string | null
          photo_url: string | null
          skills: string[] | null
          sports: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_photo_url?: string | null
          created_at?: string
          first_name?: string
          gender?: string | null
          id?: string
          languages?: string[] | null
          last_name?: string
          organization?: string | null
          photo_url?: string | null
          skills?: string[] | null
          sports?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_photo_url?: string | null
          created_at?: string
          first_name?: string
          gender?: string | null
          id?: string
          languages?: string[] | null
          last_name?: string
          organization?: string | null
          photo_url?: string | null
          skills?: string[] | null
          sports?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scout_uploaded_reports: {
        Row: {
          created_at: string
          description: string | null
          file_name: string | null
          file_url: string
          id: string
          scout_user_id: string
          source_report_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          scout_user_id: string
          source_report_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          scout_user_id?: string
          source_report_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_uploaded_reports_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "scout_player_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_verification_requests: {
        Row: {
          created_at: string | null
          document_url: string
          id: string
          reviewed_at: string | null
          reviewer_notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_url: string
          id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          document_url?: string
          id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_url: string
          overlay_text: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url: string
          overlay_text?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string
          overlay_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      test_reference_videos: {
        Row: {
          created_at: string
          test_key: string
          updated_at: string
          updated_by: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          test_key: string
          updated_at?: string
          updated_by?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          test_key?: string
          updated_at?: string
          updated_by?: string | null
          video_url?: string
        }
        Relationships: []
      }
      user_favourites: {
        Row: {
          created_at: string
          favourite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favourite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favourite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_invite_codes: {
        Row: {
          code: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_privacy_settings: {
        Row: {
          account_visibility: string
          allow_profile_pic_expansion: boolean
          auto_confirm_followers: boolean
          feed_activity_visibility: string
          flag_for_review: boolean
          group_chat_visibility: string
          hide_like_share_counts: boolean
          hide_unwanted_comments: string
          hide_unwanted_requests: boolean
          invitation_code: string | null
          is_private_account: boolean
          manually_approve_tags: boolean
          mentions_visibility: string
          message_requests_visibility: string
          posts_comments_visibility: string
          posts_to_stories_enabled: boolean
          preferred_languages: string[]
          reposts_enabled: boolean
          stories_comments_visibility: string
          stories_to_stories: string
          story_replies_visibility: string
          story_shares_enabled: boolean
          tags_visibility: string
          translate_reels_text: boolean
          translate_voice: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_visibility?: string
          allow_profile_pic_expansion?: boolean
          auto_confirm_followers?: boolean
          feed_activity_visibility?: string
          flag_for_review?: boolean
          group_chat_visibility?: string
          hide_like_share_counts?: boolean
          hide_unwanted_comments?: string
          hide_unwanted_requests?: boolean
          invitation_code?: string | null
          is_private_account?: boolean
          manually_approve_tags?: boolean
          mentions_visibility?: string
          message_requests_visibility?: string
          posts_comments_visibility?: string
          posts_to_stories_enabled?: boolean
          preferred_languages?: string[]
          reposts_enabled?: boolean
          stories_comments_visibility?: string
          stories_to_stories?: string
          story_replies_visibility?: string
          story_shares_enabled?: boolean
          tags_visibility?: string
          translate_reels_text?: boolean
          translate_voice?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_visibility?: string
          allow_profile_pic_expansion?: boolean
          auto_confirm_followers?: boolean
          feed_activity_visibility?: string
          flag_for_review?: boolean
          group_chat_visibility?: string
          hide_like_share_counts?: boolean
          hide_unwanted_comments?: string
          hide_unwanted_requests?: boolean
          invitation_code?: string | null
          is_private_account?: boolean
          manually_approve_tags?: boolean
          mentions_visibility?: string
          message_requests_visibility?: string
          posts_comments_visibility?: string
          posts_to_stories_enabled?: boolean
          preferred_languages?: string[]
          reposts_enabled?: boolean
          stories_comments_visibility?: string
          stories_to_stories?: string
          story_replies_visibility?: string
          story_shares_enabled?: boolean
          tags_visibility?: string
          translate_reels_text?: boolean
          translate_voice?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_submissions: {
        Row: {
          created_at: string
          grade: number | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          test_key: string
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          grade?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          test_key: string
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          grade?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          test_key?: string
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      weekly_challenge_badges: {
        Row: {
          challenge_type: Database["public"]["Enums"]["weekly_challenge_type"]
          earned_at: string
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          challenge_type: Database["public"]["Enums"]["weekly_challenge_type"]
          earned_at?: string
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          challenge_type?: Database["public"]["Enums"]["weekly_challenge_type"]
          earned_at?: string
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_challenges: {
        Row: {
          baseline: Json
          challenge_type: Database["public"]["Enums"]["weekly_challenge_type"]
          completed_at: string | null
          created_at: string
          id: string
          status: string
          unlocked_test: string | null
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          baseline?: Json
          challenge_type: Database["public"]["Enums"]["weekly_challenge_type"]
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          unlocked_test?: string | null
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          baseline?: Json
          challenge_type?: Database["public"]["Enums"]["weekly_challenge_type"]
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          unlocked_test?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_collaboration_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      accept_follow_request: {
        Args: { _follow_id: string }
        Returns: undefined
      }
      am_i_restricted_by: { Args: { _other_user_id: string }; Returns: boolean }
      can_add_to_group: { Args: { _target_user_id: string }; Returns: boolean }
      can_comment_on_post: { Args: { _post_id: string }; Returns: boolean }
      can_message_user: { Args: { _other_user_id: string }; Returns: boolean }
      can_reply_to_story: {
        Args: { _story_owner_id: string }
        Returns: boolean
      }
      can_view_profile: { Args: { _profile_user_id: string }; Returns: boolean }
      censor_profanity: { Args: { input_text: string }; Returns: string }
      current_week_start: { Args: never; Returns: string }
      get_approved_verification_ids: {
        Args: { _user_ids: string[] }
        Returns: {
          user_id: string
        }[]
      }
      get_conversation_previews: {
        Args: { p_conversation_ids: string[]; p_user_id: string }
        Returns: {
          conversation_id: string
          last_content: string
          last_created_at: string
          last_read: boolean
          last_sender_id: string
          unread_count: number
        }[]
      }
      get_group_message_previews: {
        Args: { p_group_ids: string[] }
        Returns: {
          content: string
          created_at: string
          group_id: string
        }[]
      }
      get_or_create_conversation: {
        Args: { other_user_id: string }
        Returns: string
      }
      get_or_create_weekly_challenge: {
        Args: { _available_tests: string[] }
        Returns: {
          challenge_type: Database["public"]["Enums"]["weekly_challenge_type"]
          completed_at: string
          id: string
          newly_completed: boolean
          status: string
          unlocked_test: string
          week_start: string
        }[]
      }
      get_post_engagement_summary: {
        Args: { p_post_ids: string[]; p_viewer_id: string }
        Returns: {
          comments_count: number
          hide_unwanted_comments: string
          liked_by_me: boolean
          likes_count: number
          post_id: string
        }[]
      }
      get_story_shares_enabled: {
        Args: { _story_owner_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_visible_likes_count: {
        Args: { p_post_id: string; p_viewer_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_session_duration: {
        Args: { p_date: string; p_seconds: number; p_user_id: string }
        Returns: number
      }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_verification_approved: { Args: { _user_id: string }; Returns: boolean }
      join_group_via_invite: { Args: { _token: string }; Returns: string }
      ping_daily_visit: {
        Args: { _available_tests: string[] }
        Returns: {
          best_login_streak: number
          best_streak: number
          current_streak: number
          days_until_next_unlock: number
          login_streak: number
          newly_unlocked: string
          next_test_preview: string
          unlocked_tests: string[]
        }[]
      }
      purge_expired_deleted_posts: { Args: never; Returns: undefined }
      reject_collaboration_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      reject_follow_request: {
        Args: { _follow_id: string }
        Returns: undefined
      }
      request_follow: { Args: { _following_id: string }; Returns: string }
      search_agents: {
        Args: { search_term: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          photo_url: string
          user_id: string
        }[]
      }
      send_collaboration_request: {
        Args: {
          _agent_user_id: string
          _initiated_by: string
          _player_user_id: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unlock_test_via_invite: { Args: { _test_key: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "player"
        | "scout"
        | "agent"
        | "club_rep"
        | "admin"
        | "cauta_jucator"
      weekly_challenge_type:
        | "add_video_highlight"
        | "add_match_video"
        | "complete_physical_data"
        | "complete_career_entry"
        | "complete_technical_test"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "player",
        "scout",
        "agent",
        "club_rep",
        "admin",
        "cauta_jucator",
      ],
      weekly_challenge_type: [
        "add_video_highlight",
        "add_match_video",
        "complete_physical_data",
        "complete_career_entry",
        "complete_technical_test",
      ],
    },
  },
} as const
