<script>
  import { onMount, onDestroy } from "svelte";
  import { loadStripe } from "@stripe/stripe-js";

  export let onPaymentComplete;
  export let slot;
  export let userInfo;
  export let onPaymentCancelled = () => {
    window.history.back();
  };

  let stripe;
  let elements;
  let paymentError = "";
  let processing = false;
  let clientSecret = "";
  let bookingId = "";
  let initialized = false;

  onMount(async () => {
    try {
      stripe = await loadStripe(import.meta.env.PUBLIC_STRIPE_KEY);
      if (!stripe) {
        throw new Error("Failed to initialize Stripe");
      }

      console.log("Checking slot availability...");
      // First check if slot is still available
      const availabilityCheck = await fetch(
        `/api/available-slots/check/${slot.id}`,
      );
      if (!availabilityCheck.ok) {
        const error = await availabilityCheck.json();
        throw new Error(error.error || "This slot is no longer available");
      }

      console.log("Creating payment intent...");
      // Create payment intent
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: slot.id,
          name: userInfo.name,
          email: userInfo.email,
          phone: userInfo.phone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || error.message || "Failed to initialize payment",
        );
      }

      console.log("Payment intent created successfully");
      const { clientSecret: secret, bookingId: id } = await response.json();
      clientSecret = secret;
      bookingId = id;

      // Create Elements instance with appearance
      elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#15803d",
          },
        },
      });

      // Create and mount payment element
      const paymentElement = elements.create("payment");
      paymentElement.mount("#payment-element");

      initialized = true;
    } catch (error) {
      console.error("Error initializing payment:", error);
      paymentError =
        error.message || "Failed to initialize payment. Please try again.";
      setTimeout(() => {
        onPaymentCancelled();
      }, 2000);
    }
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements || processing || !initialized) return;

    processing = true;
    paymentError = "";

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking/success?booking=${bookingId}`,
        },
      });

      if (submitError) {
        throw submitError;
      }

      onPaymentComplete();
    } catch (error) {
      console.error("Payment error:", error);
      paymentError = error.message;
      processing = false;
    }
  }

  onDestroy(() => {
    if (elements) {
      elements.destroy();
    }
  });
</script>

<form on:submit={handleSubmit} class="space-y-6">
  <div class="bg-white p-6 rounded-lg shadow-sm border">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold">Payment Details</h3>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6" viewBox="0 0 32 21">
        <path d="M32 0H0v21h32V0z" fill="#6772E5" />
        <path
          d="M13.2 6.15h-2c-.11 0-.2.09-.2.2v4.7c0 .11.09.2.2.2h2c.11 0 .2-.09.2-.2v-4.7c0-.11-.09-.2-.2-.2zm4.4 0h-2c-.11 0-.2.09-.2.2v4.7c0 .11.09.2.2.2h2c.11 0 .2-.09.2-.2v-4.7c0-.11-.09-.2-.2-.2zm4.4 0h-2c-.11 0-.2.09-.2.2v4.7c0 .11.09.2.2.2h2c.11 0 .2-.09.2-.2v-4.7c0-.11-.09-.2-.2-.2z"
          fill="#FFF" />
      </svg>
    </div>

    <div class="mb-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <div class="text-sm font-medium">Amount: £100.00</div>
          <div class="text-sm text-gray-600">One hour consultation</div>
        </div>
        {#if processing}
          <div class="text-sm text-yellow-600 flex items-center">
            <span class="inline-block animate-spin mr-2">⏳</span>
            Processing...
          </div>
        {/if}
      </div>

      <div id="payment-element" class="mb-6"></div>

      {#if paymentError}
        <div
          class="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
          {paymentError}
        </div>
      {/if}
    </div>

    <div class="flex space-x-4">
      <button
        type="button"
        on:click={onPaymentCancelled}
        disabled={processing}
        class="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
        Cancel
      </button>

      <button
        type="submit"
        disabled={processing || !initialized}
        class="flex-1 py-3 px-4 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed">
        {processing ? "Processing..." : "Pay £100.00"}
      </button>
    </div>

    <div class="text-center text-sm text-gray-500 mt-4">
      <p>Secure payment processing by Stripe.</p>
      <p class="mt-1">
        Your payment information is encrypted and never stored on our servers.
      </p>
    </div>
  </div>
</form>
