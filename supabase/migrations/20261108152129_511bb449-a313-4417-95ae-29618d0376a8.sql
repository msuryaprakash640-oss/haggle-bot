DROP POLICY "Users view messages in own negotiations" ON public.negotiation_messages;
DROP POLICY "Users add messages to own negotiations" ON public.negotiation_messages;

CREATE POLICY "Users view messages in own negotiations" ON public.negotiation_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.negotiations n
            WHERE n.id = negotiation_messages.negotiation_id AND n.user_id = auth.uid())
  );
CREATE POLICY "Users add messages to own negotiations" ON public.negotiation_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.negotiations n
            WHERE n.id = negotiation_messages.negotiation_id AND n.user_id = auth.uid())
  );

DROP FUNCTION public.owns_negotiation(uuid);