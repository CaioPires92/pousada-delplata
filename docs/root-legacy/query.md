# Query para deletar reservas de testes


DELETE FROM Payment
WHERE bookingId IN (
  SELECT b.id
  FROM Booking b
  JOIN Guest g ON g.id = b.guestId
  WHERE g.email = 'caiocgp92@gmail.com'
);

DELETE FROM Booking
WHERE guestId IN (
  SELECT id FROM Guest WHERE email = 'caiocgp92@gmail.com'
);

-- opcional: apagar hóspede sem reservas
DELETE FROM Guest
WHERE email = 'seu-email-teste@dominio.com'
  AND id NOT IN (SELECT guestId FROM Booking);
