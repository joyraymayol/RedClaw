const GREETINGS = [
  "Welcome",
  "Welcome back",
  "Good to see you",
  "Great to see you",
  "Hey",
  "Hi",
  "Glad you're here",
] as const;

export function randomGreeting() {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}
