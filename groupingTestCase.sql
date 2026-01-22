drop table if exists t;
create table t(num, fruit, color);

insert into t values(1, 'apple', 'red');
insert into t values(2, 'apple', 'red');
insert into t values(3, 'apple', 'red');
insert into t values(4, 'apple', 'green');
insert into t values(5, 'apple', 'green');
insert into t values(6, 'banana', 'red');
insert into t values(7, 'apple', 'red');

select * from t;

-- Source - https://stackoverflow.com/a/79873257
-- Posted by MatBailie
-- Retrieved 2026-01-21, License - CC BY-SA 4.0

-- WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING ! WORKING !
WITH
    partitioning AS
        (
            SELECT
                *,
                ROW_NUMBER() OVER (                   ORDER BY num)
                    -
                ROW_NUMBER() OVER (PARTITION BY fruit, color ORDER BY num)
                    AS partition_id
            FROM
                t
        )
SELECT
    MAX(num),
    fruit, color,
    COUNT(*)
FROM
    partitioning
GROUP BY
    fruit, color,
    partition_id
ORDER BY
    MAX(num);

SELECT
    *,
    CASE WHEN
             fruit = LAG(fruit) OVER (ORDER BY num)
             THEN
             0
         ELSE
             1
        END
        AS change_fruit
FROM
    t;


with
    changes as (select *, case when fruit <> lag(fruit) over (order by num) then 1 end as changing from t),
    groups as (select *, count(changing) over (order by num) gid from changes)
select max(num) max_num, fruit, count(*)
from groups
group by gid, fruit
order by gid;


WITH
    partitioning AS
        (
            SELECT *,
                ROW_NUMBER() OVER (ORDER BY moment)
                    -
                ROW_NUMBER() OVER (PARTITION BY type, uri, name ORDER BY moment)
                    AS partition_id
            FROM
                history
        )
SELECT
    MAX(moment),
    type, uri, name,
    COUNT(*) as row_count,
    SUM(ref_count) as sum_ref_count
FROM
    partitioning
GROUP BY

    type, uri, name,
    partition_id
ORDER BY
    MAX(moment);

select * from compressed_history
limit 50;