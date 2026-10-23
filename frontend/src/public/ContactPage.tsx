import { motion } from 'framer-motion'
import { Mail, MapPin, Phone, Send } from 'lucide-react'
import { useState } from 'react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', org: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <span className="text-accent text-sm font-semibold uppercase tracking-wider">Get in Touch</span>
          <h1 className="text-5xl font-black text-white mt-2 mb-4">Contact Us</h1>
          <p className="text-secondary text-lg max-w-xl mx-auto">
            Interested in a demo or have questions about deployment? We'd love to hear from you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact info */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="space-y-6">
              {[
                { icon: Mail, label: 'Email', value: 'contact@safewatchai.com' },
                { icon: MapPin, label: 'Location', value: 'Available worldwide via remote demo' },
                { icon: Phone, label: 'Response time', value: 'Within 1 business day' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-secondary text-xs font-medium">{item.label}</p>
                      <p className="text-white font-medium">{item.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-10 card p-6 border border-accent/20 bg-accent/5">
              <p className="text-accent font-semibold mb-2">For Demos</p>
              <p className="text-secondary text-sm leading-relaxed">
                We offer live demonstrations showing real-time detection, zone configuration, incident management, and the full admin portal. No hardware required on your end.
              </p>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {sent ? (
              <div className="card p-10 border border-accent/20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                  <Send size={28} className="text-accent" />
                </div>
                <h3 className="text-white font-bold text-xl mb-2">Message sent!</h3>
                <p className="text-secondary">We'll get back to you within one business day.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card p-8 space-y-4 border border-white/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Name</label>
                    <input className="input" placeholder="Your name" required
                      value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" placeholder="you@example.com" required
                      value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="label">Organization</label>
                  <input className="input" placeholder="Your organization"
                    value={form.org} onChange={e => setForm({...form, org: e.target.value})} />
                </div>
                <div>
                  <label className="label">Message</label>
                  <textarea className="input min-h-[140px] resize-none" placeholder="Tell us about your use case..."
                    value={form.message} onChange={e => setForm({...form, message: e.target.value})} required />
                </div>
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <Send size={16} /> Send Message
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
