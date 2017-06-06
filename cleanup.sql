pragma foreign_keys = on; 
delete from users where id>2;
delete from classrooms where title like "Fake Class _____________";
delete from classroom_sessions where title like "fake session _____________";
delete from groups where title like "fake group _";
delete from group_sessions where title like "fake group _";
