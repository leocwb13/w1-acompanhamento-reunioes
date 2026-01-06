export type MeetingType = string;
export type TaskStatus = 'backlog' | 'pendente' | 'em_andamento' | 'em_revisao' | 'concluida' | 'cancelada';
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type TaskOwner = 'Leonardo' | 'Cliente';
export type ClientStatus = 'ativo' | 'inativo' | 'prospecto';
export type UserRole = 'user' | 'admin' | 'webmaster';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          full_name: string;
          company_name: string | null;
          is_admin: boolean;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          company_name?: string | null;
          is_admin?: boolean;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          company_name?: string | null;
          is_admin?: boolean;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      meeting_types: {
        Row: {
          id: string;
          user_id: string | null;
          code: string;
          display_name: string;
          description: string;
          color: string;
          icon: string;
          is_system: boolean;
          is_active: boolean;
          order_position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          code: string;
          display_name: string;
          description?: string;
          color?: string;
          icon?: string;
          is_system?: boolean;
          is_active?: boolean;
          order_position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          code?: string;
          display_name?: string;
          description?: string;
          color?: string;
          icon?: string;
          is_system?: boolean;
          is_active?: boolean;
          order_position?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      webmaster_audit_logs: {
        Row: {
          id: string;
          webmaster_id: string;
          action: string;
          target_user_id: string | null;
          target_resource: string | null;
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          webmaster_id: string;
          action: string;
          target_user_id?: string | null;
          target_resource?: string | null;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          webmaster_id?: string;
          action?: string;
          target_user_id?: string | null;
          target_resource?: string | null;
          metadata?: any;
          created_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          revenue_bracket: string | null;
          status: ClientStatus;
          last_activity_date: string | null;
          risk_score: number;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          revenue_bracket?: string | null;
          status?: ClientStatus;
          last_activity_date?: string | null;
          risk_score?: number;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          revenue_bracket?: string | null;
          status?: ClientStatus;
          last_activity_date?: string | null;
          risk_score?: number;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      meetings: {
        Row: {
          id: string;
          client_id: string;
          type: MeetingType;
          datetime: string;
          transcript_text: string | null;
          summary: string | null;
          decisions: any;
          risk_signals: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          type: MeetingType;
          datetime: string;
          transcript_text?: string | null;
          summary?: string | null;
          decisions?: any;
          risk_signals?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          type?: MeetingType;
          datetime?: string;
          transcript_text?: string | null;
          summary?: string | null;
          decisions?: any;
          risk_signals?: string | null;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          client_id: string;
          meeting_id: string | null;
          title: string;
          description: string | null;
          owner: TaskOwner;
          status: TaskStatus;
          priority: TaskPriority;
          due_date: string;
          completed_at: string | null;
          assigned_date: string;
          order_position: number;
          blocked: boolean;
          blocked_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          meeting_id?: string | null;
          title: string;
          description?: string | null;
          owner: TaskOwner;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_date: string;
          completed_at?: string | null;
          assigned_date?: string;
          order_position?: number;
          blocked?: boolean;
          blocked_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          meeting_id?: string | null;
          title?: string;
          description?: string | null;
          owner?: TaskOwner;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_date?: string;
          completed_at?: string | null;
          assigned_date?: string;
          order_position?: number;
          blocked?: boolean;
          blocked_reason?: string | null;
          created_at?: string;
        };
      };
      decisions: {
        Row: {
          id: string;
          meeting_id: string;
          description: string;
          is_implemented: boolean;
          implemented_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          description: string;
          is_implemented?: boolean;
          implemented_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          description?: string;
          is_implemented?: boolean;
          implemented_at?: string | null;
          created_at?: string;
        };
      };
      email_drafts: {
        Row: {
          id: string;
          client_id: string;
          meeting_id: string | null;
          subject: string;
          html_body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          meeting_id?: string | null;
          subject: string;
          html_body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          meeting_id?: string | null;
          subject?: string;
          html_body?: string;
          created_at?: string;
        };
      };
      conversation_history: {
        Row: {
          id: string;
          client_id: string | null;
          user_message: string;
          assistant_response: string;
          sources_cited: any;
          embedding: number[] | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          user_message: string;
          assistant_response: string;
          sources_cited?: any;
          embedding?: number[] | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          user_message?: string;
          assistant_response?: string;
          sources_cited?: any;
          embedding?: number[] | null;
          timestamp?: string;
        };
      };
      risk_events: {
        Row: {
          id: string;
          client_id: string;
          event_type: string;
          description: string | null;
          score_impact: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          event_type: string;
          description?: string | null;
          score_impact?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          event_type?: string;
          description?: string | null;
          score_impact?: number;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: string | null;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: string | null;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string | null;
          description?: string | null;
          updated_at?: string;
        };
      };
      client_metadata: {
        Row: {
          id: string;
          client_id: string;
          document_number: string | null;
          birth_date: string | null;
          address_street: string | null;
          address_city: string | null;
          address_state: string | null;
          address_zip: string | null;
          monthly_income: number | null;
          estimated_patrimony: number | null;
          financial_goals: string | null;
          contact_preference: string | null;
          best_contact_time: string | null;
          tags: string[];
          notes: string | null;
          custom_fields: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          document_number?: string | null;
          birth_date?: string | null;
          address_street?: string | null;
          address_city?: string | null;
          address_state?: string | null;
          address_zip?: string | null;
          monthly_income?: number | null;
          estimated_patrimony?: number | null;
          financial_goals?: string | null;
          contact_preference?: string | null;
          best_contact_time?: string | null;
          tags?: string[];
          notes?: string | null;
          custom_fields?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          document_number?: string | null;
          birth_date?: string | null;
          address_street?: string | null;
          address_city?: string | null;
          address_state?: string | null;
          address_zip?: string | null;
          monthly_income?: number | null;
          estimated_patrimony?: number | null;
          financial_goals?: string | null;
          contact_preference?: string | null;
          best_contact_time?: string | null;
          tags?: string[];
          notes?: string | null;
          custom_fields?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      client_portal_access: {
        Row: {
          id: string;
          client_id: string;
          access_token: string;
          enabled: boolean;
          last_access_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          access_token?: string;
          enabled?: boolean;
          last_access_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          access_token?: string;
          enabled?: boolean;
          last_access_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string;
          price_monthly: number;
          currency: string;
          credits_per_month: number | null;
          features: any;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description: string;
          price_monthly?: number;
          currency?: string;
          credits_per_month?: number | null;
          features?: any;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string;
          price_monthly?: number;
          currency?: string;
          credits_per_month?: number | null;
          features?: any;
          is_active?: boolean;
          created_at?: string;
        };
      };
      plan_limits: {
        Row: {
          plan_id: string;
          portal_enabled: boolean;
          whatsapp_enabled: boolean;
          webhooks_enabled: boolean;
          kanban_enabled: boolean;
          custom_branding: boolean;
          api_access_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          plan_id: string;
          portal_enabled?: boolean;
          whatsapp_enabled?: boolean;
          webhooks_enabled?: boolean;
          kanban_enabled?: boolean;
          custom_branding?: boolean;
          api_access_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan_id?: string;
          portal_enabled?: boolean;
          whatsapp_enabled?: boolean;
          webhooks_enabled?: boolean;
          kanban_enabled?: boolean;
          custom_branding?: boolean;
          api_access_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          credits_used: number;
          credits_reset_at: string | null;
          payment_provider_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          credits_used?: number;
          credits_reset_at?: string | null;
          payment_provider_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          credits_used?: number;
          credits_reset_at?: string | null;
          payment_provider_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
