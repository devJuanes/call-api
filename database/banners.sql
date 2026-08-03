-- Optional: run after schema.sql if banners table already applied separately
INSERT INTO banners (id, title, subtitle, image_url, cta_label, cta_action, badge_label, accent_color, sort_order, is_active)
SELECT gen_random_uuid(), v.title, v.subtitle, v.image_url, v.cta_label, v.cta_action, v.badge_label, v.accent_color, v.sort_order, true
FROM (VALUES
  (
    E'Connect\nCollaborate\ncreate',
    'Start a voice meeting with your team in seconds',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    'Start a Meeting',
    'start_meeting',
    'Live Now',
    '#FF8FA3',
    0
  ),
  (
    E'Share your\nroom code',
    'Invite anyone with the room ID — they join from phone or web',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    'View meetings',
    'none',
    'How to',
    '#7EB6FF',
    1
  ),
  (
    E'Group chat\nin every call',
    'Messages stay with the meeting so the whole room stays aligned',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
    'Open chats',
    'none',
    'Tip',
    '#6FCF97',
    2
  )
) AS v(title, subtitle, image_url, cta_label, cta_action, badge_label, accent_color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM banners LIMIT 1);
