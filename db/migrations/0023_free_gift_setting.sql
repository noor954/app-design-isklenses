ALTER TABLE public.store_settings
  DROP CONSTRAINT IF EXISTS store_settings_key_check;

ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_key_check
  CHECK (key IN (
    'announcements',
    'contact',
    'headings',
    'seo_sections',
    'footer',
    'product_page',
    'delivery_rules',
    'chatbot',
    'appearance',
    'home_configuration',
    'power_options',
    'free_gift'
  ));
