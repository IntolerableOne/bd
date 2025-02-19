<script>
  import { onMount } from 'svelte';
  import { loadStripe } from '@stripe/stripe-js';

  export let slot;
  export let userInfo;
  export let onPaymentComplete;

  let stripe;
  let elements;
  let card;
  let paymentError = '';
  let processing = false;

  onMount(async () => {
    // Initialize Stripe
    stripe = await loadStripe(import.meta.env.PUBLIC_STRIPE_KEY);
    
    // Create payment intent
    try {
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

      if (!response.ok) throw new Error('Failed to create payment intent');
      
      const { clientSecret } = await response.json();
      
      // Create card element
      elements = stripe.elements();
      card = elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#32325d',
            '::placeholder': {
              color: '#aab7c4'
            }
          },
          invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
          }
        }
      });
      
      card.mount('#card-element');
      card.addEventListener('change', handleChange);

      // Store client secret for payment
      elements.clientSecret = clientSecret;
    } catch (error) {
      console.error('Error initializing payment:', error);
      paymentError = 'Failed to initialize payment. Please try again.';
    }
  });

  function handleChange(event) {
    if (event.error) {
      paymentError = event.error.message;
    } else {
      paymentError = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements) return;

    processing = true;
    paymentError = '';

    try {
      const { error: submitError } = await stripe.confirmCardPayment(
        elements.clientSecret,
        {
          payment_method: {
            card: card,
            billing_details: {
              name: userInfo.name,
              email: userInfo.email
            }
          }
        }
      );

      if (submitError) {
        paymentError = submitError.message;
      } else {
        onPaymentComplete();
      }
    } catch (error) {
      console.error('Payment error:', error);
      paymentError = 'Payment failed. Please try again.';
    } finally {
      processing = false;
    }
  }

  onDestroy(() => {
    if (card) {
      card.removeEventListener('change', handleChange);
      card.destroy();
    }
  });
</script>

<form on:submit={handleSubmit} class="space-y-6">
  <div class="bg-white p-6 rounded-lg shadow-sm border-2">
    <h3 class="text-xl font-bold mb-4">Payment Details</h3>
    
    <div class="mb-6">
      <div class="text-sm font-medium mb-2">Amount: £100.00</div>
      <div class="text-sm text-gray-600 mb-4">
        One hour consultation with {slot.midwife}
      </div>
      
      <div id="card-element" class="p-3 border rounded-lg bg-gray-50"></div>
      
      {#if paymentError}
        <div class="text-red-600 text-sm mt-2">{paymentError}</div>
      {/if}
    </div>

    <button
      type="submit"
      disabled={processing}
      class="w-full py-3 px-4 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed">
      {processing ? 'Processing...' : 'Pay £100.00'}
    </button>
  </div>
</form>