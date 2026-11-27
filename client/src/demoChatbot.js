const topics = [
  { match: /art fair|gallery|exhibition/, label: 'the art fair', replies: ['I would start with the student photography section ✨', 'The art fair sounds even better with good company 😄'] },
  { match: /music|song|playlist|concert/, label: 'music', replies: ['Send me one song for the walk there 🎧', 'A good playlist can rescue any long campus day 😄'] },
  { match: /football|basketball|match|game|sports?/, label: 'sports', replies: ['Are you going to watch or get on the court? 🏀', 'Campus match days have the best energy 🙌'] },
  { match: /study|class|exam|lecture|assignment|library/, label: 'campus life', replies: ['A study break and a snack sound well deserved ☕', 'What subject has been taking most of your time lately? 📚'] },
  { match: /coffee|tea|rolex|food|lunch|dinner|eat/, label: 'food', replies: ['I am always open to a good campus food recommendation 😋', 'You pick the snack spot and I will bring the conversation ☕'] },
  { match: /date|crush|cute|flirt|handsome|beautiful|pretty|love you/, label: 'the vibe between us', replies: ['You are smooth 😄 Want to keep this playful and tell me your ideal first date?', 'That made me smile 😊 What kind of connection are you hoping to find?'] },
  { match: /sad|stress|stressed|lonely|tired|rough|bad day/, label: 'how you are feeling', replies: ['That sounds like a lot. Want to tell me what part has been weighing on you?', 'I am glad you said something. Would a distraction or a listening ear help more? 💛'] },
  { match: /event|party|open mic|meetup/, label: 'campus events', replies: ['That could be a fun plan 🎉 Who would you want to bring along?', 'I like a good campus event. What kind of music or activities are you hoping for?'] },
  { match: /tech|science|project|coding|research/, label: 'your ideas', replies: ['That sounds interesting. What got you started on it? 🔬', 'I like hearing what people are building. What is the next step? 💡'] },
]

const personaReplies = {
  'demo-amina': ['Tell me more 😊', 'I am listening. What happened next?', 'That is a good story so far ✨'],
  'demo-joel': ['Okay, I am curious now 😄', 'You have my attention 👀', 'That is a whole vibe 🎶'],
  'demo-nadia': ['That sounds lovely 🌿', 'I get what you mean 😊', 'What would make it even better?'],
  'demo-brian': ['Nice one 🙌', 'I am with you on that 🏀', 'Tell me how it goes!'],
  'demo-zara': ['Interesting! What made you think of that? ✨', 'I would love to hear the rest 😊', 'That is a good question. What do you think?'],
  'demo-isaac': ['That is a solid idea 💡', 'How would you build it?', 'I like where you are going with this 🙌'],
  'demo-grace': ['That deserves a microphone 🎤', 'You have a story there ✨', 'I would listen to that whole set 😄'],
  'demo-daniel': ['Now we are talking 😄', 'I like the way you think 💡', 'What is your next move?'],
  'demo-ruth': ['That is so you 😄', 'Add a good snack and I am sold 😋', 'I like this plan ✨'],
  'demo-kevin': ['Let us figure it out ⚡', 'That is worth exploring 🔬', 'What have you tried so far?'],
  'demo-esther': ['That has a little drama to it 🎭', 'I can picture the scene already ✨', 'What happens in the next act?'],
  'demo-peter': ['Game on 🏀', 'I like the competitive energy 🙌', 'Who is your team?'],
  'demo-mariam': ['That is a thoughtful take ✨', 'Make your case 😊', 'I am listening. Go on.'],
}

const choose = (items, seed) => items[Math.abs(seed) % items.length]

export function generateDemoReply(person, messages) {
  const history = messages.slice(-30)
  const lastUserMessage = [...history].reverse().find((message) => message.sender_id === 'me')?.body?.trim() || ''
  const earlierUserText = history.filter((message) => message.sender_id === 'me').slice(0, -1).map((message) => message.body || '').join(' ')
  const topic = topics.find((item) => item.match.test(lastUserMessage))
  const earlierTopic = topics.find((item) => item.match.test(earlierUserText))

  if (/^(hi|hey|hello|heyy|hii)[!.\s]*$/i.test(lastUserMessage)) {
    return history.filter((message) => message.sender_id === 'me').length > 1
      ? `Hey, you are back 😊 How has ${earlierTopic?.label || 'your week'} been going?`
      : `Hey! I am ${person.name.split(' ')[0]}, a Campus Pulse demo chatbot 😊 What has been the best part of your day?`
  }

  if (topic && earlierTopic?.label === topic.label && earlierUserText) {
    return `You mentioned ${topic.label} earlier too. ${choose(topic.replies, history.length + lastUserMessage.length)}`
  }
  if (topic) return choose(topic.replies, history.length + lastUserMessage.length)

  if (/\?$/.test(lastUserMessage)) return choose(personaReplies[person.id] || personaReplies['demo-amina'], history.length)
  if (/\b(thanks|thank you|asante)\b/i.test(lastUserMessage)) return choose(['Anytime 😊', 'Of course! That is what a good chat is for ✨', 'You are welcome 🙌'], history.length)
  return choose(personaReplies[person.id] || personaReplies['demo-amina'], history.length + lastUserMessage.length)
}
