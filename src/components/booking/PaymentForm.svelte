<script>
  import { onMount, onDestroy } from "svelte";
  import { loadStripe } from "@stripe/stripe-js";

  /**
   * Callback function to execute when payment is successfully completed.
   * Stripe typically handles the redirect on success via `return_url`.
   */
  export let onPaymentComplete;

  /**
   * The selected slot object. Expected to have an `id` property (availabilityId).
   * @type {{ id: string, date: Date, startTime: string, midwife: string }}
   */
  export let slot;

  /**
   * User information object.
   * @type {{ name: string, email: string, phone: string }}
   */
  export let userInfo;

  /**
   * Callback function to execute when the payment process is cancelled by the user.
   */
  export let onPaymentCancelled = () => {
    // Default behavior can be navigating back or handled by the parent component.
    console.log("Payment cancellation default handler invoked.");
  };

  // Stripe.js instance
  let stripe;
  // Stripe Elements instance
  let elements;
  // Stores any payment-related error messages
  let paymentError = "";
  // Flag to indicate if a payment is currently being processed
  let processing = false;
  // Client secret for the Stripe Payment Intent
  let clientSecret = "";
  // ID of the booking record created on the backend
  let bookingId = "";
  // Flag to indicate if the Stripe Payment Element has been initialized
  let initialized = false;

  /**
   * Handles the user's action to cancel the payment.
   * It attempts to release the hold on the slot by calling a backend API endpoint.
   */
  async function handlePaymentCancellation() {
    if (processing) return; // Prevent action if already processing
    processing = true;

    console.log('Payment cancelled by user. BookingId:', bookingId, 'SlotId:', slot?.id);

    if (bookingId) {
      try {
        // API call to release the hold and potentially delete the unpaid booking record.
        const response = await fetch(`/api/holds/release/${bookingId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})); // Gracefully handle non-JSON error responses
          console.error('Failed to release hold on cancellation:', response.status, errorData.error || 'Unknown server error');
        } else {
          console.log('Hold released successfully for bookingId:', bookingId);
        }
      } catch (error) {
        console.error('Error calling hold release API:', error);
      }
    } else {
      console.warn('No bookingId available to release hold. This might happen if payment intent creation failed early.');
    }

    processing = false;
    onPaymentCancelled(); // Invoke the callback passed by the parent component
  }

  /**
   * Initializes Stripe.js, checks slot availability, creates a payment intent,
   * and mounts the Stripe Payment Element when the component is mounted.
   */
  onMount(async () => {
    try {
      // Load Stripe.js with the public key from environment variables
      stripe = await loadStripe(import.meta.env.PUBLIC_STRIPE_KEY);
      if (!stripe) {
        throw new Error("Failed to initialize Stripe.js. Stripe object is null.");
      }

      // Step 1: Check if the selected slot is still available
      console.log("Verifying slot availability for slotId:", slot?.id);
      if (!slot || !slot.id) {
        throw new Error("Slot information is missing. Cannot proceed with payment.");
      }
      const availabilityCheckResponse = await fetch(
        `/api/available-slots/check/${slot.id}`,
      );
      if (!availabilityCheckResponse.ok) {
        // Attempt to parse error from backend, otherwise use a generic message
        const errorJson = await availabilityCheckResponse.json().catch(() => null);
        throw new Error(errorJson?.error || `Slot availability check failed with status: ${availabilityCheckResponse.status}`);
      }
      const availabilityData = await availabilityCheckResponse.json();
      if (!availabilityData.available) {
         throw new Error(availabilityData.error || "This appointment slot is no longer available. Please select another.");
      }
      console.log("Slot is available. Proceeding to create payment intent.");

      // Step 2: Create a Payment Intent on the backend
      const paymentIntentResponse = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: slot.id, // This is the availabilityId
          name: userInfo.name,
          email: userInfo.email,
          phone: userInfo.phone,
        }),
      });

      if (!paymentIntentResponse.ok) {
        const errorJson = await paymentIntentResponse.json().catch(() => null);
        throw new Error(
          errorJson?.error || errorJson?.message || `Failed to initialize payment. Server responded with status: ${paymentIntentResponse.status}`,
        );
      }
      const { clientSecret: secret, bookingId: id } = await paymentIntentResponse.json();
      clientSecret = secret;
      bookingId = id; // Store the bookingId associated with this payment attempt
      console.log("Payment intent created successfully. BookingId:", bookingId);

      // Step 3: Initialize Stripe Elements and mount the Payment Element
      elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: "stripe", // Or 'night', 'flat', etc.
          variables: {
            colorPrimary: "#15803d", // Tailwind green-700
            colorBackground: "#ffffff",
            colorText: "#374151", // Tailwind gray-700
            colorDanger: "#dc2626", // Tailwind red-600
            fontFamily: "Inter, sans-serif",
            spacingUnit: "4px",
            borderRadius: "6px",
          },
        },
      });
      const paymentElement = elements.create("payment");
      paymentElement.mount("#payment-element"); // Mount to the div with id="payment-element"

      initialized = true; // Mark as initialized
    } catch (error) {
      console.error("Error during payment form initialization:", error);
      paymentError = error.message || "An unexpected error occurred while setting up the payment form. Please try refreshing the page or contact support.";
      // Optionally, automatically trigger cancellation or show a retry option
    }
  });

  /**
   * Handles the form submission to confirm the payment with Stripe.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    // Prevent submission if Stripe.js, Elements are not loaded, or if already processing, or if not initialized
    if (!stripe || !elements || processing || !initialized) {
      console.warn("Payment form not ready for submission or already processing.");
      return;
    }

    processing = true;
    paymentError = ""; // Clear previous errors

    try {
      // Confirm the payment with Stripe
      const { error: stripeConfirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Redirect URL after successful payment or if further action is needed (e.g., 3D Secure)
          // Ensure bookingId is correctly passed for the success page to retrieve booking details.
          return_url: `${window.location.origin}/booking/success?bookingId=${bookingId}`,
          payment_method_data: {
            billing_details: {
              name: userInfo.name,
              email: userInfo.email,
              phone: userInfo.phone, // Optional: Stripe uses this for fraud prevention and receipts
            }
          }
        },
        // If you want to handle the result directly without an immediate redirect (e.g., for 3DS):
        // redirect: 'if_required'
      });

      if (stripeConfirmError) {
        // This error could be due to card declines, authentication failures, etc.
        // The payment intent and hold are still active.
        console.error("Stripe confirmPayment error:", stripeConfirmError);
        throw stripeConfirmError; // Let the catch block handle it
      }
      // If `redirect: 'if_required'` was used and no error, check paymentIntent.status.
      // Typically, Stripe handles the redirect if `return_url` is provided and payment is successful or needs SCA.
      // `onPaymentComplete` might be called by the parent component after redirect and verification on the success page.

    } catch (error) {
      console.error("Payment submission error:", error);
      paymentError = error.message || "Payment failed. Please check your card details and try again. If the problem persists, contact support.";
      processing = false; // Allow user to try again
    }
    // Note: `processing` is not set to `false` immediately after `stripe.confirmPayment` if a redirect is expected,
    // as the page will navigate away. It's set to false in the catch block for retries.
  }

  /**
   * Cleans up Stripe Elements when the component is destroyed.
   */
  onDestroy(() => {
    if (elements) {
      // It's good practice to destroy Stripe Elements to clean up resources,
      // though if the Payment Element is the only one, it might not be strictly necessary
      // if the page is navigating away.
      // const paymentElement = elements.getElement('payment');
      // if (paymentElement) {
      //   paymentElement.destroy();
      // }
      console.log("PaymentForm destroyed. Stripe Elements could be cleaned up here if needed.");
    }
  });
</script>

<form on:submit={handleSubmit} class="space-y-6" aria-label="Payment Form">
  <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
      <h3 class="text-xl font-semibold text-gray-800">Payment Details</h3>
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="h-7 w-auto text-indigo-600" viewBox="0 0 32 21">
        <title>Stripe Logo</title>
        <path d="M32 0H0v21h32V0z" fill="#6772E5" />
        <path
          d="M13.2 6.15h-2c-.11 0-.2.09-.2.2v4.7c0 .11.09.2.2.2h2c.11 0 .2-.09.2-.2v-4.7c0-.11-.09-.2-.2-.2zm4.4 0h-2c-.11 0-.2.09-.2.2v4.7c0 .11.09.2.2.2h2c.11 0 .2-.09.2-.2v-4.7c0-.11-.09-.2-.2-.2zm4.4 0h-2c-.11 0-.2.09-.2.2v4.7c0 .11.09.2.2.2h2c.11 0 .2-.09.2-.2v-4.7c0-.11-.09-.2-.2-.2z"
          fill="#FFF" />
      </svg>
    </div>

    <div class="mb-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <p class="text-md font-medium text-gray-700">Amount: <span class="font-bold text-gray-900">£100.00</span></p>
          <p class="text-sm text-gray-500">One hour consultation</p>
        </div>
        {#if processing && !paymentError}
          <div class="text-sm text-yellow-600 flex items-center" role="status" aria-live="polite">
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-yellow-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing payment...
          </div>
        {/if}
      </div>

      <div id="payment-element" class="mb-6 min-h-[150px] flex items-center justify-center">
        {#if !initialized && !paymentError}
         <div class="flex flex-col items-center justify-center text-center py-10 text-gray-500" role="status" aria-live="polite">
            <svg class="animate-spin h-8 w-8 text-green-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p>Initializing secure payment form...</p>
            <p class="text-xs mt-1">Please wait.</p>
          </div>
        {/if}
      </div>

      {#if paymentError}
        <div
          class="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md"
          role="alert"
        >
          <p class="font-semibold">Payment Error</p>
          <p class="text-sm">{paymentError}</p>
        </div>
      {/if}
    </div>

    <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
      <button
        type="button"
        on:click={handlePaymentCancellation}
        disabled={processing}
        class="w-full sm:w-auto flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition-colors duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed">
        Cancel
      </button>

      <button
        type="submit"
        disabled={processing || !initialized || !!paymentError} class="w-full sm:w-auto flex-1 py-3 px-4 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed">
        {#if processing && !paymentError}
          Processing...
        {:else}
          Pay £100.00
        {/if}
      </button>
    </div>

    <div class="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-200">
      <p class="flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
        </svg>
        Secure payment processing by Stripe.
      </p>
      <p class="mt-1">
        Your payment information is encrypted and will not be stored on our servers.
      </p>
    </div>
  </div>
</form>
