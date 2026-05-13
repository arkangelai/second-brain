import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface InvitationEmailProps {
  teamName: string;
  inviterName: string;
  role: string;
  acceptLink: string;
}

export function InvitationEmail({
  teamName,
  inviterName,
  role,
  acceptLink,
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to the {teamName} brain on Second Brain.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Join {teamName}</Heading>
          <Text style={text}>
            {inviterName} invited you to collaborate in Second Brain as{" "}
            <strong>{role}</strong>.
          </Text>
          <Section style={section}>
            <Button href={acceptLink} style={button}>
              Accept invite
            </Button>
          </Section>
          <Text style={muted}>
            This invitation expires in 7 days. If the button does not work, open
            this link: {acceptLink}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#0f0f10",
  color: "#f5f5f4",
  fontFamily:
    '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "40px 24px",
  maxWidth: "520px",
};

const heading = {
  fontSize: "28px",
  lineHeight: "34px",
  margin: "0 0 20px",
};

const text = {
  color: "#d6d3d1",
  fontSize: "16px",
  lineHeight: "24px",
};

const section = {
  margin: "28px 0",
};

const button = {
  backgroundColor: "#f5f5f4",
  borderRadius: "6px",
  color: "#111111",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 18px",
  textDecoration: "none",
};

const muted = {
  color: "#a8a29e",
  fontSize: "13px",
  lineHeight: "20px",
};
