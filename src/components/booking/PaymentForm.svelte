<script>
  import { onMount, onDestroy } from 'svelte';
  import { loadStripe } from '@stripe/stripe-js';

  export let onPaymentComplete;
  export let slot;
  export let userInfo;
  // Default no-op function for cancel
  export let onPaymentCancelled = () => {
    window.history.back();
  };

  let stripe;
  let elements;
  let paymentError = '';
  let processing = false;
  let holdCreated = false;
  let holdCheckInterval;

  onMount(async () => {
    stripe = await loadStripe(import.meta.env.PUBLIC_STRIPE_KEY);
    
    try {
      // First check if slot is still available
      const availabilityCheck = await fetch(`/api/available-slots/check/${slot.id}`);
      if (!availabilityCheck.ok) {
        throw new Error('This slot is no longer available');
      }

      // Create payment intent which also creates a hold
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          name: userInfo.name,
          email: userInfo.email,
          phone: userInfo.phone
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize payment');
      }
      
      const { clientSecret } = await response.json();
      holdCreated = true;
      
      // Create Elements instance
      elements = stripe.elements();
      
      // Create and mount individual card elements
      const cardNumber = elements.create('cardNumber', {
        style: getElementStyle()
      });
      const cardExpiry = elements.create('cardExpiry', {
        style: getElementStyle()
      });
      const cardCvc = elements.create('cardCvc', {
        style: getElementStyle()
      });

      cardNumber.mount('#card-number');
      cardExpiry.mount('#card-expiry');
      cardCvc.mount('#card-cvc');

      // Add event listeners
      [cardNumber, cardExpiry, cardCvc].forEach(element => {
        element.on('change', handleChange);
      });

      // Store client secret for payment
      elements.clientSecret = clientSecret;

      // Start checking hold status
      startHoldCheck();
    } catch (error) {
      console.error('Error initializing payment:', error);
      paymentError = error.message || 'Failed to initialize payment. Please try again.';
      onPaymentCancelled();
    }
  });

  function startHoldCheck() {
    // Check hold status every 30 seconds
    holdCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/available-slots/check/${slot.id}`);
        const data = await response.json();
        
        if (!data.available && !data.held) {
          // Slot was taken by someone else
          clearInterval(holdCheckInterval);
          paymentError = 'This slot is no longer available';
          onPaymentCancelled();
        }
      } catch (error) {
        console.error('Error checking hold status:', error);
      }
    }, 30000); // 30 seconds
  }

  function getElementStyle() {
    return {
      base: {
        fontSize: '16px',
        color: '#32325d',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        '::placeholder': {
          color: '#aab7c4'
        },
        padding: '10px 0',
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a'
      }
    };
  }

  function handleChange(event) {
    if (event.error) {
      paymentError = event.error.message;
    } else {
      paymentError = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements || processing) return;

    processing = true;
    paymentError = '';

    try {
      const { error: submitError } = await stripe.confirmCardPayment(
        elements.clientSecret,
        {
          payment_method: {
            card: elements.getElement('cardNumber'),
            billing_details: {
              name: userInfo.name,
              email: userInfo.email
            }
          }
        }
      );

      if (submitError) {
        throw new Error(submitError.message);
      }

      onPaymentComplete();
    } catch (error) {
      console.error('Payment error:', error);
      paymentError = error.message;
    } finally {
      processing = false;
    }
  }

  async function handleCancel() {
    if (holdCreated) {
      try {
        await fetch(`/api/holds/${slot.id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Error releasing hold:', error);
      }
    }
    onPaymentCancelled();
  }

  onDestroy(() => {
    // Clean up elements and intervals
    if (elements) {
      ['cardNumber', 'cardExpiry', 'cardCvc'].forEach(elementType => {
        const element = elements.getElement(elementType);
        if (element) {
          element.destroy();
        }
      });
    }
    
    if (holdCheckInterval) {
      clearInterval(holdCheckInterval);
    }

    // Release hold if payment wasn't completed
    if (holdCreated && !processing) {
      handleCancel();
    }
  });
</script>

<form on:submit={handleSubmit} class="space-y-6">
  <div class="bg-white p-6 rounded-lg shadow-sm border">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold">Payment Details</h3>
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 452 188" class="h-6">>
        <defs>
          <path id="a" d="M0 1h452v187H0V1z"/>
        </defs>
        <g fill="none" fill-rule="evenodd">
          <mask id="b" fill="#fff">
            <use xlink:href="#a"/>
          </mask>
          <path fill="#1A1918" d="M47 85c-10-4-15-6-15-11 0-4 3-6 9-6 10 0 20 4 27 8l4-25c-6-3-17-7-33-7-11 0-20 3-27 8C5 58 1 66 1 76c0 18 11 26 29 33 12 4 16 7 16 11 0 5-4 7-11 7-8 0-22-4-31-9l-4 25c8 4 22 9 37 9 12 0 22-3 28-9 8-5 12-14 12-25 0-19-12-27-30-33zm95-15 4-24h-21V16l-29 5-4 25-10 1-3 23h13v49c0 12 3 21 10 26 5 4 13 7 24 7 9 0 14-2 18-3v-26l-10 2c-6 0-9-4-9-11V70h17zm63-26c-9 0-16 5-19 14l-2-12h-29v104h33V82c4-5 10-7 18-7l6 1V45l-7-1zm31-8c10 0 18-8 18-18s-8-17-18-17c-9 0-17 7-17 17s8 18 17 18zm-16 10h33v104h-33V46zm127 9c-6-7-14-11-25-11-9 0-18 4-25 12l-2-10h-29v142l33-5v-34l15 3c8 0 20-3 29-13 9-9 14-24 14-44 0-18-3-31-10-40zm-28 64c-2 5-6 8-11 8l-9-2V76c5-6 11-7 12-7 9 0 13 9 13 27 0 10-2 18-5 23zm133-22c0-17-4-30-11-39s-18-14-32-14c-28 0-45 21-45 54 0 19 4 33 14 42 8 8 20 12 35 12 14 0 27-4 35-9l-3-23c-8 5-18 7-28 7-7 0-11-1-14-4-4-3-6-8-7-15h55l1-11zm-56-9c1-15 5-22 13-22 7 0 11 7 12 22h-25z" mask="url(#b)"/>
        </g>
      </svg>
    </div>
    
    <div class="mb-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <div class="text-sm font-medium">Amount: £100.00</div>
          <div class="text-sm text-gray-600">
            One hour consultation with {slot.midwife}
          </div>
        </div>
        {#if processing}
          <div class="text-sm text-yellow-600 flex items-center">
            <span class="inline-block animate-spin mr-2">⏳</span>
            Processing...
          </div>
        {/if}
      </div>
      
      <div class="space-y-4">
        <div>
          <label for="card-number" class="block text-sm font-medium text-gray-700 mb-1">
            Card number
          </label>
          <div id="card-number" class="p-3 border rounded-lg bg-white"></div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="card-expiry" class="block text-sm font-medium text-gray-700 mb-1">
              Expiration date
            </label>
            <div id="card-expiry" class="p-3 border rounded-lg bg-white"></div>
          </div>

          <div>
            <label for="card-cvc" class="block text-sm font-medium text-gray-700 mb-1">
              CVC
            </label>
            <div id="card-cvc" class="p-3 border rounded-lg bg-white"></div>
          </div>
        </div>
      </div>
      
      {#if paymentError}
        <div class="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
          {paymentError}
        </div>
      {/if}
    </div>

    <div class="flex space-x-4">
      <button
        type="button"
        on:click={handleCancel}
        disabled={processing}
        class="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
        Cancel
      </button>

      <button
        type="submit"
        disabled={processing}
        class="flex-1 py-3 px-4 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed">
        {processing ? 'Processing...' : 'Pay £100.00'}
      </button>
    </div>

    <div class="text-center text-sm text-gray-500 mt-4">
      <p>Secure payment processing by Stripe.</p>
      <p class="mt-1">Your payment information is encrypted and never stored on our servers.</p>
    </div>
  </div>
</form>

<style>
  :global(.StripeElement) {
    min-height: 40px;
  }
</style>