<script>
  import { onMount } from 'svelte';
  
  let isOpen = false;
  let currentStep = 1;
  let formData = {
    name: '',
    email: '',
    mobile: '',
    selectedSlot: ''
  };
  
  let errors = {
    name: '',
    email: '',
    selectedSlot: ''
  };
  
  onMount(() => {
    const handleHashChange = () => {
      isOpen = window.location.hash === '#booking';
      if (isOpen) {
        currentStep = 1;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    };
    
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      document.body.style.overflow = 'auto';
    };
  });

  function close() {
    isOpen = false;
    window.location.hash = '';
    currentStep = 1;
  }

  function validateStep1() {
    let isValid = true;
    errors = {
      name: '',
      email: '',
      selectedSlot: ''
    };

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
      isValid = false;
    }

    return isValid;
  }

  function nextStep() {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !formData.selectedSlot) {
      errors.selectedSlot = 'Please select a time slot';
      return;
    }
    if (currentStep < 3) currentStep++;
  }

  function prevStep() {
    if (currentStep > 1) currentStep--;
  }

  // Example available time slots for next 7 days
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      ['10:00', '11:00', '14:00', '15:00', '16:00'].forEach(time => {
        slots.push({
          date: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          time: time,
          available: Math.random() > 0.3 // Randomly mark some slots as unavailable
        });
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-emerald-100 z-50 overflow-y-auto"
    role="dialog"
    aria-modal="true">
    
    <!-- Header - matches navbar exactly -->
      <div class="max-w-screen-xl mx-auto px-5 my-5">
        <div class="flex w-full items-center justify-between">
          <a href="/" class="text-2xl font-extrabold text-green-700 tracking-tight flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="944.43 544.17 747.14 658.8" width="65" height="65">  <path fill="#d1fae5" d="M1317 1151c0 32 35 49 58 29 74-65 125-109 173-160 127-134 117-258 117-258v-8c0-104-82-187-182-196-31-3-58 0-82 6a115 115 0 0 0-84 111Z"></path>  <path fill="none" stroke="#15803d" stroke-miterlimit="10" stroke-width="25.3" d="M1317 1151c0 32 35 49 58 29 74-65 125-109 173-160 127-134 117-258 117-258v-8c0-104-82-187-182-196-31-3-58 0-82 6a115 115 0 0 0-84 111Z"></path>  <path fill="#d1fae5" d="M1317 1150c0 32-34 49-57 29-73-65-125-108-172-159-128-134-117-258-117-258v-8c0-104 81-187 181-196 31-3 57 0 81 6 51 15 84 60 84 111z"></path>  <path fill="none" stroke="#15803d" stroke-miterlimit="10" stroke-width="25.3" d="M1317 1150c0 32-34 49-57 29-73-65-125-108-172-159-128-134-117-258-117-258v-8c0-104 81-187 181-196 31-3 57 0 81 6 51 15 84 60 84 111z"></path>  <path fill="#d1fae5" d="M1461 1022c22-18 55-51 60-82 2-16-14-26-28-18-37 22-106 72-144 137-52 93-36 143 27 129 61-13 256-137 293-248 36-110-37-117-44-81-13 57-84 157-158 173-6 2-10-6-6-10"></path>  <path fill="none" stroke="#15803d" stroke-miterlimit="10" stroke-width="25.3" d="M1461 1022c22-18 55-51 60-82 2-16-14-26-28-18-37 22-106 72-144 137-52 93-36 143 27 129 61-13 256-137 293-248 36-110-37-117-44-81-13 57-84 157-158 173-6 2-10-6-6-10Z"></path>  <path fill="#d1fae5" stroke="#15803d" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="25.3" d="M1223 598s14 54 86 58m-305 0s16 55 87 59m66-155s-61 144 102 168"></path>  <path fill="#d1fae5" stroke="#15803d" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="25.3" d="M1137 783s-8-56 34-85m145 110s-31-33-85-16c-26 7-56 28-67 75 0 0-52-45-117 0"></path>  <path fill="#d1fae5" stroke="#15803d" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="25.3" d="M1080 774s-8 46 19 73m208 127s-99 5-75-98"></path>  <path fill="#d1fae5" d="M1175 1022c-22-18-55-51-59-82-3-16 15-26 27-18 37 22 106 72 144 137 53 93 36 143-27 129-61-13-256-137-293-248-36-110 37-117 45-81 12 57 83 157 157 173 6 2 10-6 6-10"></path>  <path fill="none" stroke="#15803d" stroke-miterlimit="10" stroke-width="25.3" d="M1175 1022c-22-18-55-51-59-82-3-16 15-26 27-18 37 22 106 72 144 137 53 93 36 143-27 129-61-13-256-137-293-248-36-110 37-117 45-81 12 57 83 157 157 173 6 2 10-6 6-10Z"></path></svg>
            <span class="ml-1.5">birthdebrief</span>
          </a>
            <button
              on:click={close}
              class="text-center relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-10 h-10">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
      </div>
 

    <!-- Progress Bar -->
      <div class="max-w-screen-xl mx-auto px-5 py-2">
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            class="bg-green-700 h-2.5 rounded-full transition-all duration-300"
            style="width: {(currentStep / 3) * 100}%">
          </div>
        </div>
      </div>

    <!-- Content -->
    <div class="max-w-screen-xl mx-auto px-5 py-8">
      {#if currentStep === 1}
        <div class="max-w-xl mx-auto">
          <form on:submit|preventDefault={nextStep} class="space-y-4">
            <div>
              <label for="name" class="sr-only">Full Name</label>
              <input
                type="text"
                id="name"
                bind:value={formData.name}
                class="w-full px-4 py-3 border-2 placeholder:text-gray-800 rounded-md outline-none focus:ring-4 border-gray-300 focus:border-gray-600 ring-gray-100"
                placeholder="Full Name"
              />
              {#if errors.name}
                <p class="mt-1 text-sm text-red-400">{errors.name}</p>
              {/if}
            </div>

            <div>
              <label for="email" class="sr-only">Email Address</label>
              <input
                type="email"
                id="email"
                bind:value={formData.email}
                class="w-full px-4 py-3 border-2 placeholder:text-gray-800 rounded-md outline-none focus:ring-4 border-gray-300 focus:border-gray-600 ring-gray-100"
                placeholder="Email Address"
              />
              {#if errors.email}
                <p class="mt-1 text-sm text-red-400">{errors.email}</p>
              {/if}
            </div>

            <div>
              <label for="mobile" class="sr-only">Mobile (Optional)</label>
              <input
                type="tel"
                id="mobile"
                bind:value={formData.mobile}
                class="w-full px-4 py-3 border-2 placeholder:text-gray-800 rounded-md outline-none focus:ring-4 border-gray-300 focus:border-gray-600 ring-gray-100"
                placeholder="Mobile Number (Optional)"
              />
            </div>

            <button
              type="submit"
              class="w-full px-6 py-3 bg-green-700 text-white rounded-md hover:bg-green-800 transition">
              Continue to Booking
            </button>
          </form>
        </div>

      {:else if currentStep === 2}
        <div class="bg-emerald-100 p-6 rounded-lg mt-8">
          {#if errors.selectedSlot}
            <p class="mb-4 text-sm text-red-600">{errors.selectedSlot}</p>
          {/if}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each timeSlots as slot}
              <button
                class="p-4 border-2 {slot.available ? 'border-green-700 hover:bg-green-50' : 'border-gray-300 bg-gray-50 cursor-not-allowed'} rounded-md transition-colors"
                disabled={!slot.available}
                on:click={() => {
                  if (slot.available) {
                    formData.selectedSlot = `${slot.date} at ${slot.time}`;
                    nextStep();
                  }
                }}>
                <div class="font-medium">{slot.date}</div>
                <div class="text-lg {slot.available ? 'text-green-700' : 'text-gray-400'}">{slot.time}</div>
                {#if !slot.available}
                  <div class="text-sm text-gray-500">Unavailable</div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

      {:else}
        <div class="bg-emerald-100 p-6 rounded-lg max-w-xl mx-auto mt-8">
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900">Booking Summary</h3>
            <dl class="mt-4 space-y-2">
              <div class="flex justify-between">
                <dt class="text-gray-600">Name:</dt>
                <dd class="font-medium">{formData.name}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-600">Appointment:</dt>
                <dd class="font-medium">{formData.selectedSlot}</dd>
              </div>
              <div class="flex justify-between pt-4 border-t">
                <dt class="text-lg font-medium">Total:</dt>
                <dd class="text-lg font-medium">£100.00</dd>
              </div>
            </dl>
          </div>
          
          <!-- Stripe payment form will be inserted here -->
          <div id="payment-element"></div>
          
          <button
            class="mt-6 w-full bg-green-700 text-white px-6 py-2 rounded-md hover:bg-green-800 transition-colors">
            Pay Now
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Add Tailwind-like styles for the menu */
  :global(.astronav-toggle.expanded) ~ .astronav-menu {
    @apply flex;
  }
</style>