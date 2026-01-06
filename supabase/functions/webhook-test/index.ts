import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestWebhookRequest {
  url: string;
  secret?: string;
  payload?: Record<string, any>;
  customHeaders?: Record<string, string>;
  httpMethod?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { url, secret, payload, customHeaders, httpMethod }: TestWebhookRequest = await req.json();

    // Validate HTTPS URL
    if (!url) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "URL is required"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Enforce HTTPS
    if (!url.startsWith("https://")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only HTTPS URLs are allowed for webhooks"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Prepare test payload
    const testPayload = payload || {
      event: "test",
      timestamp: new Date().toISOString(),
      message: "This is a test webhook from your application",
    };

    // Prepare headers - start with defaults
    const webhookHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Webhook-Test/1.0",
    };

    // Add custom headers from configuration (if provided)
    if (customHeaders) {
      Object.entries(customHeaders).forEach(([key, value]) => {
        // Don't allow overriding critical headers
        if (key.toLowerCase() !== 'content-type' && key.toLowerCase() !== 'user-agent') {
          webhookHeaders[key] = value;
        }
      });
    }

    // Add secret if provided
    if (secret) {
      webhookHeaders["X-Webhook-Secret"] = secret;
    }

    // Make the webhook request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const startTime = Date.now();
      const method = httpMethod || "POST";

      // For GET and DELETE, don't send body
      const fetchOptions: RequestInit = {
        method: method,
        headers: webhookHeaders,
        signal: controller.signal,
      };

      // Only add body for methods that support it
      if (method !== "GET" && method !== "HEAD" && method !== "DELETE") {
        fetchOptions.body = JSON.stringify(testPayload);
      }

      const response = await fetch(url, fetchOptions);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      clearTimeout(timeoutId);

      // Get response body
      let responseBody: any;
      const contentType = response.headers.get("content-type");
      
      try {
        if (contentType?.includes("application/json")) {
          responseBody = await response.json();
        } else {
          responseBody = await response.text();
        }
      } catch (e) {
        responseBody = "(unable to parse response body)";
      }

      // Return detailed response
      return new Response(
        JSON.stringify({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          responseTime: `${responseTime}ms`,
          body: responseBody,
          headers: Object.fromEntries(response.headers.entries()),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      // Handle different error types
      let errorMessage = "Failed to connect to webhook URL";
      let errorType = "connection_error";

      if (fetchError.name === "AbortError") {
        errorMessage = "Request timed out after 10 seconds";
        errorType = "timeout";
      } else if (fetchError.message.includes("getaddrinfo") || fetchError.message.includes("DNS")) {
        errorMessage = "Could not resolve hostname (DNS error)";
        errorType = "dns_error";
      } else if (fetchError.message.includes("certificate") || fetchError.message.includes("SSL")) {
        errorMessage = "SSL certificate error";
        errorType = "ssl_error";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errorType,
          details: fetchError.message,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error: any) {
    console.error("Webhook test error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});