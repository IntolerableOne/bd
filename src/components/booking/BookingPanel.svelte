<script>
  import Calendar from './Calendar.svelte';
  import PaymentForm from './PaymentForm.svelte';
  
  let currentStep = 1;
  let selectedSlot = null;
  let userInfo = {
    name: '',
    email: '',
    phone: ''
  };
  let bookingComplete = false;

  function nextStep() {
    if (currentStep === 2 && !selectedSlot) {
      alert('Please select an appointment slot before continuing');
      return;
    }
    if (currentStep < 3) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  function handlePaymentComplete() {
    bookingComplete = true;
  }
</script>

<div class="max-w-4xl mx-auto">
  <!-- Progress Steps -->
  <div class="mb-8">
    <div class="flex justify-between">
      <div class="flex-1">
        <div class="relative">
          <div class="h-2 bg-green-700 rounded-l-full" class:w-full={currentStep > 1} class:w-0={currentStep === 1}></div>
          <div class="absolute -top-4 left-0 w-10 h-10 rounded-full bg-green-700 text-white flex items-center justify-center">1</div>
        </div>
      </div>
      <div class="flex-1">
        <div class="relative">
          <div class="h-2 bg-green-700" class:w-full={currentStep > 2} class:w-0={currentStep <= 1}></div>
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full {currentStep >= 2 ? 'bg-green-700' : 'bg-gray-300'} text-white flex items-center justify-center">2</div>
        </div>
      </div>
      <div class="flex-1">
        <div class="relative">
          <div class="h-2 bg-green-700 rounded-r-full" class:w-full={currentStep === 3} class:w-0={currentStep <= 2}></div>
          <div class="absolute -top-4 right-0 w-10 h-10 rounded-full {currentStep === 3 ? 'bg-green-700' : 'bg-gray-300'} text-white flex items-center justify-center">3</div>
        </div>
      </div>
    </div>
    <div class="flex justify-between mt-4">
      <span class="text-sm font-medium">Your Details</span>
      <span class="text-sm font-medium">Select Time</span>
      <span class="text-sm font-medium">Payment</span>
    </div>
  </div>

  {#if bookingComplete}
    <div class="text-center py-8 px-4 bg-green-50 rounded-lg">
      <h2 class="text-2xl font-bold text-green-700 mb-4">Booking Confirmed!</h2>
      <p class="mb-4">Thank you for your booking. You will receive a confirmation email shortly.</p>
      <p class="text-sm text-gray-600">
        If you don't receive an email within 5 minutes, please check your spam folder or contact us.
      </p>
    </div>
  {:else}
    <!-- Content -->
    {#if currentStep === 1}
      <div class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            id="name"
            bind:value={userInfo.name}
            class="w-full px-4 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            id="email"
            bind:value={userInfo.email}
            class="w-full px-4 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            id="phone"
            bind:value={userInfo.phone}
            class="w-full px-4 py-2 border rounded-md"
            required
          />
        </div>
      </div>
    {:else if currentStep === 2}
      <Calendar bind:selectedSlot />
    {:else}
      <PaymentForm
        slot={selectedSlot}
        {userInfo}
        onPaymentComplete={handlePaymentComplete}
      />
    {/if}

    <!-- Navigation Buttons -->
    <div class="flex justify-between mt-8">
      {#if currentStep > 1}
        <button
          class="px-6 py-2 border-2 border-green-700 text-green-700 rounded-lg hover:bg-green-50"
          on:click={prevStep}>
          Back
        </button>
      {:else}
        <div></div>
      {/if}

      {#if currentStep < 3}
        <button
          class="px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
          on:click={nextStep}>
          Continue
        </button>
      {/if}
    </div>
  {/if}
</div>