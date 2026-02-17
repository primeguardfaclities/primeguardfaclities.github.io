// Sticky Navbar Shadow
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if(window.scrollY > 50) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');
});

// Fade-in Sections
const faders = document.querySelectorAll(".fade-in");
const appearOptions = { threshold:0.3 };
const appearOnScroll = new IntersectionObserver((entries, observer)=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, appearOptions);
faders.forEach(fader => appearOnScroll.observe(fader));

// Animated Counters with Progress
const counters = document.querySelectorAll(".count");
counters.forEach(counter=>{
  const progressBar = counter.closest('.stat').querySelector('.progress-bar');
  counter.innerText='0';
  const target = +counter.getAttribute('data-target');
  let current=0;
  const increment = target/200;
  const update = ()=>{
    current += increment;
    if(current < target){ counter.innerText = Math.ceil(current); requestAnimationFrame(update); }
    else { counter.innerText = target.toLocaleString(); progressBar.style.width = progressBar.getAttribute('data-progress'); }
  };
  update();
});

// Testimonial Carousel
let currentTestimonial = 0;
const testimonials = document.querySelectorAll(".testimonial-card");
function showTestimonial(index){
  testimonials.forEach((t,i)=>t.classList.remove('active'));
  testimonials[index].classList.add('active');
}
showTestimonial(0);
setInterval(()=>{
  currentTestimonial = (currentTestimonial+1)%testimonials.length;
  showTestimonial(currentTestimonial);
}, 5000);

// Mobile Menu Toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');
navToggle.addEventListener('click', ()=> navMenu.classList.toggle('open'));
